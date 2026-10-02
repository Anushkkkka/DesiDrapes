import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api, errorMessage } from '../lib/api';
import { formatPrice } from '../lib/format';
import type { AssistantResponse, Product } from '../lib/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  products?: Product[];
}

const SUGGESTIONS = ['Wedding outfit for my husband under $150', 'Festive lehenga for a little girl', 'Elegant saree for a party'];

/** Floating AI stylist: grounded in the live catalog by the API. */
export default function StyleAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Namaste! I'm your DesiDrapes stylist. Tell me the occasion, who it's for and your budget, and I'll find something lovely." },
  ]);
  const listRef = useRef<HTMLDivElement>(null);

  const ask = useMutation({
    mutationFn: (message: string) =>
      api<AssistantResponse>('/ai/assistant', {
        method: 'POST',
        body: { message, history: messages.slice(1).map(({ role, content }) => ({ role, content })) },
      }),
    onSuccess: (r) => setMessages((m) => [...m, { role: 'assistant', content: r.reply, products: r.products }]),
    onError: (err) => setMessages((m) => [...m, { role: 'assistant', content: `Sorry, ${errorMessage(err).toLowerCase()}` }]),
  });

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, ask.isPending]);

  const send = (text: string) => {
    const message = text.trim();
    if (message.length < 2 || ask.isPending) return;
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setInput('');
    ask.mutate(message);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-black px-4 py-3 text-sm text-white shadow-lg transition hover:bg-gray-800"
        aria-expanded={open}
        aria-controls="style-assistant"
      >
        <span aria-hidden>✨</span> {open ? 'Close stylist' : 'AI Stylist'}
      </button>

      {open && (
        <section
          id="style-assistant"
          aria-label="AI style assistant"
          className="fixed bottom-20 right-5 z-40 flex h-[32rem] max-h-[75vh] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
        >
          <header className="border-b bg-gray-50 px-4 py-3">
            <p className="prata-regular text-gray-800">DesiDrapes Stylist</p>
            <p className="text-xs text-gray-500">AI suggestions from our live catalog</p>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === 'user' ? 'bg-black text-white' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {m.content}
                </div>
                {m.products && m.products.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {m.products.map((p) => (
                      <Link
                        key={p.id}
                        to={`/product/${p.slug}`}
                        onClick={() => setOpen(false)}
                        className="rounded border border-gray-200 p-1.5 text-xs hover:border-black"
                      >
                        <img src={p.images[0]} alt="" className="aspect-[3/4] w-full rounded object-cover" loading="lazy" />
                        <p className="mt-1 line-clamp-2">{p.name}</p>
                        <p className="font-medium">{formatPrice(p.price)}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {ask.isPending && <div className="w-16 animate-pulse rounded-2xl bg-gray-100 px-3 py-2 text-sm text-gray-500">…</div>}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:border-black">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="flex gap-2 border-t p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              placeholder="Ask for outfit ideas…"
              className="flex-1 rounded-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
              aria-label="Message the stylist"
            />
            <button disabled={ask.isPending || input.trim().length < 2} className="rounded-full bg-black px-4 text-sm text-white disabled:opacity-40">
              Send
            </button>
          </form>
        </section>
      )}
    </>
  );
}
