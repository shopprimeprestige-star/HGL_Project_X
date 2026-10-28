/** ── LE NOTIFICHE PUSH, SENZA LIBRERIE ──────────────────────────────────────
 *
 *  Richiesta del titolare (28/10/2026): «se un cliente scrive su WhatsApp non
 *  ho nessun modo per capirlo». Il CRM gira nel browser; su iPhone (da iOS
 *  16.4) un sito aggiunto alla schermata Home può ricevere notifiche push come
 *  un'app, anche a telefono bloccato.
 *
 *  Qui le due cose che lo standard chiede a chi spedisce, fatte con WebCrypto
 *  (c'è sia nel Worker di Cloudflare sia in Node, quindi si prova):
 *   · la FIRMA VAPID (RFC 8292): un JWT ES256 che dice al servizio di Apple /
 *     Google / Mozilla chi siamo;
 *   · la CIFRATURA del messaggio (RFC 8291, «aes128gcm»): il servizio push
 *     trasporta il messaggio ma non può leggerlo.
 *  Nessuna dipendenza nuova: le librerie note (web-push) vogliono Node e non
 *  girano nel Worker.
 *
 *  ⚠️ La prova usa l'esempio dell'Appendice A di RFC 8291: se la cifratura
 *   sbaglia anche un byte, quel testo non si decifra.
 *  ───────────────────────────────────────────────────────────────────────── */

const te = new TextEncoder();

/* ── base64url ─────────────────────────────────────────────────────────── */

export function daB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  const pieno = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(pieno);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function aB64url(b: Uint8Array | ArrayBuffer): string {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let bin = "";
  for (const x of u) bin += String.fromCharCode(x);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const unisci = (...parti: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parti.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parti) {
    out.set(p, i);
    i += p.length;
  }
  return out;
};

/** WebCrypto vuole un ArrayBuffer «vero»: una vista su un buffer più grande
 *  passerebbe anche i byte fuori dalla vista. */
const buf = (u: Uint8Array): ArrayBuffer =>
  u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

async function hmac(chiave: Uint8Array, dati: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    "raw",
    buf(chiave),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, buf(dati)));
}

/** HKDF con un solo blocco di uscita (bastano 32 byte): estrai + espandi. */
async function hkdf(sale: Uint8Array, ikm: Uint8Array, info: Uint8Array, lunghezza: number) {
  const prk = await hmac(sale, ikm);
  const t = await hmac(prk, unisci(info, new Uint8Array([1])));
  return t.slice(0, lunghezza);
}

/** La chiave pubblica P-256 non compressa (65 byte) come JWK. */
function jwkPubblica(raw: Uint8Array): JsonWebKey {
  if (raw.length !== 65 || raw[0] !== 4) throw new Error("chiave pubblica non valida");
  return {
    kty: "EC",
    crv: "P-256",
    x: aB64url(raw.slice(1, 33)),
    y: aB64url(raw.slice(33, 65)),
    ext: true,
  };
}

/* ── LA CIFRATURA (RFC 8291) ───────────────────────────────────────────── */

export interface CoppiaEffimera {
  privata: CryptoKey;
  /** 65 byte, non compressa */
  pubblica: Uint8Array;
}

/** Una coppia di chiavi ECDH nuova per ogni messaggio. */
export async function nuovaCoppia(): Promise<CoppiaEffimera> {
  const k = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  return {
    privata: k.privateKey,
    pubblica: new Uint8Array(await crypto.subtle.exportKey("raw", k.publicKey)),
  };
}

/** Una coppia da chiavi note (solo per le prove: l'esempio di RFC 8291). */
export async function coppiaDa(privataB64: string, pubblicaB64: string): Promise<CoppiaEffimera> {
  const pubblica = daB64url(pubblicaB64);
  const privata = await crypto.subtle.importKey(
    "jwk",
    { ...jwkPubblica(pubblica), d: privataB64 },
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  return { privata, pubblica };
}

async function chiaviDelMessaggio(p: {
  segreto: Uint8Array;
  uaPubblica: Uint8Array;
  asPubblica: Uint8Array;
  auth: Uint8Array;
  sale: Uint8Array;
}): Promise<{ cek: Uint8Array; nonce: Uint8Array }> {
  const infoChiave = unisci(te.encode("WebPush: info\0"), p.uaPubblica, p.asPubblica);
  const ikm = await hkdf(p.auth, p.segreto, infoChiave, 32);
  const cek = await hkdf(p.sale, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(p.sale, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  return { cek, nonce };
}

/** Il corpo cifrato da spedire, con la sua intestazione (sale, rs, chiave). */
export async function cifra(p: {
  /** `p256dh` dell'iscrizione */
  uaPubblica: string;
  /** `auth` dell'iscrizione */
  auth: string;
  testo: string;
  /** per le prove; altrimenti nuove a ogni messaggio */
  coppia?: CoppiaEffimera;
  sale?: Uint8Array;
}): Promise<Uint8Array> {
  const ua = daB64url(p.uaPubblica);
  const auth = daB64url(p.auth);
  const coppia = p.coppia ?? (await nuovaCoppia());
  const sale = p.sale ?? crypto.getRandomValues(new Uint8Array(16));
  const uaChiave = await crypto.subtle.importKey(
    "jwk",
    jwkPubblica(ua),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const segreto = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaChiave }, coppia.privata, 256),
  );
  const { cek, nonce } = await chiaviDelMessaggio({
    segreto,
    uaPubblica: ua,
    asPubblica: coppia.pubblica,
    auth,
    sale,
  });
  //  Un solo record: il testo, poi 0x02 (fine dell'ultimo record).
  const chiaro = unisci(te.encode(p.testo), new Uint8Array([2]));
  const k = await crypto.subtle.importKey("raw", buf(cek), "AES-GCM", false, ["encrypt"]);
  const cifrato = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: buf(nonce) }, k, buf(chiaro)),
  );
  const rs = new Uint8Array([0, 0, 0x10, 0]); // 4096
  return unisci(sale, rs, new Uint8Array([coppia.pubblica.length]), coppia.pubblica, cifrato);
}

/** Il contrario di `cifra`, dalla parte del telefono. Serve SOLO alle prove:
 *  è il modo di controllare la cifratura contro l'esempio ufficiale. */
export async function decifra(p: {
  corpo: Uint8Array;
  uaPrivata: string;
  uaPubblica: string;
  auth: string;
}): Promise<string> {
  const sale = p.corpo.slice(0, 16);
  const idlen = p.corpo[20];
  const asPubblica = p.corpo.slice(21, 21 + idlen);
  const cifrato = p.corpo.slice(21 + idlen);
  const ua = await coppiaDa(p.uaPrivata, p.uaPubblica);
  const asChiave = await crypto.subtle.importKey(
    "jwk",
    jwkPubblica(asPubblica),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const segreto = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: asChiave }, ua.privata, 256),
  );
  const { cek, nonce } = await chiaviDelMessaggio({
    segreto,
    uaPubblica: ua.pubblica,
    asPubblica,
    auth: daB64url(p.auth),
    sale,
  });
  const k = await crypto.subtle.importKey("raw", buf(cek), "AES-GCM", false, ["decrypt"]);
  const chiaro = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf(nonce) }, k, buf(cifrato)),
  );
  let fine = chiaro.length - 1;
  while (fine >= 0 && chiaro[fine] === 0) fine--;
  return new TextDecoder().decode(chiaro.slice(0, fine));
}

/* ── LA FIRMA VAPID (RFC 8292) ─────────────────────────────────────────── */

export interface ChiaviVapid {
  /** 65 byte non compressi, base64url: va anche al browser per iscriversi */
  pubblica: string;
  /** i 32 byte di `d`, base64url: solo nel server */
  privata: string;
  /** «mailto:…» o un indirizzo https: chi contattare se qualcosa va storto */
  soggetto: string;
}

/** L'intestazione `Authorization` per un indirizzo push. */
export async function firmaVapid(
  endpoint: string,
  v: ChiaviVapid,
  adesso = Date.now(),
): Promise<string> {
  const aud = new URL(endpoint).origin;
  const testa = aB64url(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corpo = aB64url(
    te.encode(JSON.stringify({ aud, exp: Math.floor(adesso / 1000) + 12 * 3600, sub: v.soggetto })),
  );
  const chiave = await crypto.subtle.importKey(
    "jwk",
    { ...jwkPubblica(daB64url(v.pubblica)), d: v.privata },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const firma = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      chiave,
      buf(te.encode(`${testa}.${corpo}`)),
    ),
  );
  return `vapid t=${testa}.${corpo}.${aB64url(firma)}, k=${v.pubblica}`;
}

/** La richiesta completa per un'iscrizione: metodo, intestazioni, corpo. */
export async function richiestaPush(
  iscrizione: { endpoint: string; p256dh: string; auth: string },
  testo: string,
  v: ChiaviVapid,
): Promise<{ url: string; init: RequestInit }> {
  const corpo = await cifra({ uaPubblica: iscrizione.p256dh, auth: iscrizione.auth, testo });
  return {
    url: iscrizione.endpoint,
    init: {
      method: "POST",
      headers: {
        Authorization: await firmaVapid(iscrizione.endpoint, v),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        //  Un giorno: un messaggio di ieri sera arriva stamattina, non dopo.
        TTL: "86400",
        Urgency: "high",
      },
      body: buf(corpo),
    },
  };
}
