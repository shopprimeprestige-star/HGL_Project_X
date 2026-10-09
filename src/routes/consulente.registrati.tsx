import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, UserPlus } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/consulente/registrati")({
  head: () => ({
    meta: [
      { title: "Diventa consulente · Hair Genius Labs" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ConsultantApply,
});

const schema = z.object({
  nome: z.string().trim().min(2, "Nome troppo corto").max(80),
  email: z.string().trim().email("Email non valida").max(120),
  telefono: z.string().trim().min(6, "Telefono non valido").max(30),
  citta: z.string().trim().max(80).optional(),
  esperienza: z.string().trim().max(500).optional(),
  motivazione: z.string().trim().max(1000).optional(),
});

function ConsultantApply() {
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefono: "",
    citta: "",
    esperienza: "",
    motivazione: "",
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("consultant_applications").insert({
      nome: parsed.data.nome,
      email: parsed.data.email,
      telefono: parsed.data.telefono,
      citta: parsed.data.citta || null,
      esperienza: parsed.data.esperienza || null,
      motivazione: parsed.data.motivazione || null,
    });
    setLoading(false);
    if (error) {
      console.error(error);
      toast.error("Errore nell'invio. Riprova tra qualche istante.");
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
            <h1 className="text-2xl font-bold">Richiesta inviata!</h1>
            <p className="text-sm text-muted-foreground">
              Abbiamo ricevuto la tua candidatura come consulente. Il nostro team la
              esaminerà al più presto. Riceverai una email di conferma all'indirizzo
              indicato non appena sarai stato approvato.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/">Torna al sito</Link>
            </Button>
          </CardContent>
        </Card>
        <Toaster />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <UserPlus className="h-6 w-6" />
              Diventa consulente
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Compila il form per candidarti. Verrai contattato dopo l'approvazione.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>Nome e cognome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
                  maxLength={80}
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  maxLength={120}
                />
              </div>
              <div>
                <Label>Telefono *</Label>
                <Input
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  required
                  maxLength={30}
                />
              </div>
              <div>
                <Label>Città (opzionale)</Label>
                <Input
                  value={form.citta}
                  onChange={(e) => setForm({ ...form, citta: e.target.value })}
                  maxLength={80}
                />
              </div>
              <div>
                <Label>Esperienza nel settore</Label>
                <Textarea
                  rows={2}
                  maxLength={500}
                  value={form.esperienza}
                  onChange={(e) => setForm({ ...form, esperienza: e.target.value })}
                  placeholder="Anni di esperienza, ruoli precedenti, competenze..."
                />
              </div>
              <div>
                <Label>Perché vuoi unirti?</Label>
                <Textarea
                  rows={3}
                  maxLength={1000}
                  value={form.motivazione}
                  onChange={(e) => setForm({ ...form, motivazione: e.target.value })}
                  placeholder="Raccontaci la tua motivazione..."
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Invio in corso..." : "Invia candidatura"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                I tuoi dati saranno trattati ai sensi della{" "}
                <Link to="/privacy-policy" className="underline">
                  privacy policy
                </Link>
                .
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
      <Toaster />
    </div>
  );
}
