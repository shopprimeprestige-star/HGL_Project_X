

## Integrazione WhatsApp Cloud API (Meta) — Modalità Test

### Parte 1 — Cosa devi fare su Meta (lato tuo, ~10 minuti)

Meta offre un ambiente di **test gratuito** che permette di inviare/ricevere messaggi reali verso un massimo di **5 numeri di telefono verificati**, senza bisogno di approvazione Business. Perfetto per partire.

**Passaggi:**

1. **Crea un account Meta for Developers**
   - Vai su https://developers.facebook.com/ → "Get Started" (usa il tuo account Facebook)
   - Conferma email + numero di telefono

2. **Crea una nuova App**
   - "My Apps" → "Create App" → tipo **"Business"** → dai un nome (es. "HairGenius CRM")

3. **Aggiungi il prodotto WhatsApp**
   - Nella dashboard dell'app → "Add Product" → trova **"WhatsApp"** → "Set Up"
   - Meta crea automaticamente:
     - Un **numero di telefono di test** (es. +1 555…)
     - Un **Phone Number ID**
     - Un **WhatsApp Business Account ID (WABA ID)**
     - Un **Temporary Access Token** (valido 24h)

4. **Aggiungi i numeri destinatari di test**
   - Dentro WhatsApp → "API Setup" → sezione "To" → "Manage phone number list"
   - Aggiungi il tuo numero personale (riceverai un codice OTP da inserire)
   - Puoi aggiungerne fino a 5

5. **Genera un Access Token permanente** (consigliato per non rifarlo ogni 24h)
   - "Business Settings" → "System Users" → "Add" → ruolo Admin
   - Assegna l'app WhatsApp come asset → "Generate New Token"
   - Permessi: `whatsapp_business_messaging`, `whatsapp_business_management`
   - Scegli "Never expire" → **copia il token** (non sarà più visibile)

6. **Configura il Webhook** (per ricevere messaggi in entrata)
   - Ti darò io l'URL esatto dopo aver creato l'endpoint nel CRM
   - Sarà tipo: `https://<tuo-dominio>/api/public/whatsapp-webhook`
   - Verify Token: una stringa segreta che scegli tu (es. `hairgenius_wh_2026`)
   - Sottoscrivi i campi: `messages`, `message_status`

---

### Parte 2 — Cosa farò io lato codice

**A. Database (nuova tabella `whatsapp_messages`)**

```text
whatsapp_messages
├── id (uuid)
├── lead_id (fk → leads, nullable se numero sconosciuto)
├── wa_message_id (id univoco Meta)
├── direction ('inbound' | 'outbound')
├── from_number, to_number
├── body (text)
├── media_url, media_type (per allegati)
├── status ('sent'|'delivered'|'read'|'failed')
├── created_at, delivered_at, read_at
└── raw_payload (jsonb — payload completo Meta)
```

Più una tabella `whatsapp_contacts` per mappare numeri → lead, e RLS che limita la lettura ai soli utenti autenticati del CRM.

**B. Secrets runtime** (li chiederò con il tool dedicato dopo la tua conferma):
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_BUSINESS_ACCOUNT_ID`

**C. Endpoint server (TanStack server routes)**
- `POST /api/whatsapp-send` → invia messaggio (autenticato, valida sessione CRM)
- `GET /api/public/whatsapp-webhook` → verifica handshake Meta (challenge)
- `POST /api/public/whatsapp-webhook` → riceve eventi (messaggi + status), valida firma `X-Hub-Signature-256`, persiste su DB

**D. Refactor del modulo `CRM.whatsapp.tsx`**
- Rimuovo le 2 chat campione hard-coded
- Carico le conversazioni reali da `whatsapp_messages` raggruppate per `lead_id` / numero
- Realtime: `supabase.channel('whatsapp')` su INSERT → nuovi messaggi appaiono live
- L'invio dal composer chiama `/api/whatsapp-send` (mantengo design WhatsApp dark attuale)
- Indicatori ✓ / ✓✓ / ✓✓ blu pilotati dai webhook `message_status`
- Badge "non letto" calcolato dai messaggi `inbound` non ancora aperti

**E. Auto-link lead↔numero**
- Quando arriva un inbound da numero non mappato, cerco un lead con `telefono` corrispondente (normalizzato E.164) e collego automaticamente. Altrimenti mostro la chat come "Sconosciuto" con bottone "Crea lead".

**F. Limiti modalità test (li mostro nell'UI come banner)**
- Solo verso i 5 numeri verificati su Meta
- Template `hello_world` preapprovato per primo contatto fuori finestra 24h
- Dopo 24h dall'ultimo messaggio del cliente serve un template approvato (per ora useremo solo conversazioni avviate dal cliente)

---

### Parte 3 — Cosa mi serve da te per partire

Dopo che hai completato i passaggi 1-5 lato Meta, ti chiederò di incollarmi nel pannello secrets:

| Secret | Dove trovarlo |
|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | App Meta → WhatsApp → API Setup → "Phone number ID" |
| `WHATSAPP_ACCESS_TOKEN` | Token permanente generato al passo 5 |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | App Meta → WhatsApp → API Setup → "WhatsApp Business Account ID" |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Stringa che scegli tu (la stessa che metterai poi nel webhook Meta) |

**Flusso operativo:**
1. Tu fai i passi 1-5 su Meta
2. Approvi questo piano → io implemento DB + endpoint + UI
3. Io ti chiedo i 4 secrets con il tool sicuro
4. Ti do l'URL webhook esatto + verify token da incollare in Meta (passo 6)
5. Test end-to-end: scrivi dal tuo telefono al numero di test → appare nel CRM in tempo reale; rispondi dal CRM → arriva sul telefono

Confermi questo piano e procedo con l'implementazione?

