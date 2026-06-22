'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Loader2, User, Copy, Check } from 'lucide-react';
import Image from 'next/image';

const AVATAR = '/aindres-montes.png';
import { useLeagueData } from '@/lib/DataContext';
import { serializeLeagueContext } from '@/lib/serializeContext';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export default function StatsChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const data = useLeagueData();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const serializedContext = useCallback(() => {
    return serializeLeagueContext({
      teams: data.teams,
      players: data.players,
      matches: data.matches,
      playerStats: data.playerStats,
      standings: data.standings,
    });
  }, [data]);

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || isLoading) return;

    setInput('');
    setError(null);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: question,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Build history (last 6 messages for context)
      const history = messages.slice(-6).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        text: m.text,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          context: serializedContext(),
          history,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Error del servidor');
      }

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: json.response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Simple markdown bold/italic rendering
  function renderMarkdown(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} style={{
          background: 'var(--color-bg-secondary)', padding: '1px 4px',
          borderRadius: 4, fontSize: '0.9em',
        }}>{part.slice(1, -1)}</code>;
      }
      return part;
    });
  }

  const suggestions = [
    '¿Quién es el jugón de la liga?',
    '¿Qué equipo tiene la defensa amarrategui?',
    'Compara los dos mejores equipos',
    '¿Quién manda en los triiiiiples?',
  ];

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 1000,
          width: 58, height: 58, borderRadius: '50%',
          background: isOpen ? 'linear-gradient(135deg, #1a73e8, #6c5ce7)' : 'transparent',
          border: 'none', cursor: 'pointer',
          padding: 0, overflow: 'hidden',
          boxShadow: isOpen ? '0 4px 20px rgba(26, 115, 232, 0.4)' : '0 4px 20px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.3s ease',
          transform: isOpen ? 'scale(0.9)' : 'scale(1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onMouseEnter={e => { if (!isOpen) e.currentTarget.style.transform = 'scale(1.1)'; }}
        onMouseLeave={e => { if (!isOpen) e.currentTarget.style.transform = 'scale(1)'; }}
        aria-label="AIndrés Montes"
      >
        {isOpen ? <X size={22} color="#fff" /> : (
          <Image src={AVATAR} alt="AIndrés Montes" width={58} height={58} style={{ borderRadius: '50%', objectFit: 'cover' }} />
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: 84, right: 16, zIndex: 999,
          width: 420, maxWidth: 'calc(100vw - 32px)',
          height: 560, maxHeight: 'calc(100vh - 110px)',
          borderRadius: 20,
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'chatSlideUp 0.3s ease',
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #1a73e8, #6c5ce7)',
            color: '#fff',
            display: 'flex', alignItems: 'center', gap: 12,
            flexShrink: 0,
          }}>
            <Image src={AVATAR} alt="AIndrés Montes" width={36} height={36} style={{ borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '0.02em' }}>🎙️ AIndrés Montes</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>La vida puede ser maravillosa 🏀</div>
            </div>
            <div style={{
              marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%',
              background: '#34c759', boxShadow: '0 0 6px #34c759',
            }} />
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '16px 16px 8px',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Image src={AVATAR} alt="AIndrés Montes" width={64} height={64} style={{ borderRadius: 16, objectFit: 'cover', marginBottom: 12, opacity: 0.85, margin: '0 auto 12px' }} />
                <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginBottom: 16 }}>
                  ¡Buenas noches, amigo! Soy <strong>AIndrés Montes</strong>, y aunque me fui al cielo de los narradores, he vuelto como IA para contarte todo sobre esta maravillosa <strong>Parish League</strong>. Pregúntame lo que quieras... ¡porque la vida puede ser maravillosa! 🎙️🏀
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 50); }}
                      style={{
                        fontSize: 11, padding: '6px 12px', borderRadius: 20,
                        border: '1px solid var(--color-border-light)',
                        background: 'var(--color-bg-secondary)',
                        color: 'var(--color-text-secondary)',
                        cursor: 'pointer', fontFamily: 'var(--font-body)',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#1a73e8'; e.currentTarget.style.color = '#1a73e8'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-light)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div
                key={msg.id}
                style={{
                  display: 'flex', gap: 8,
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                }}
              >
                {msg.role === 'user' ? (
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: 'linear-gradient(135deg, #1a73e8, #6c5ce7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff',
                  }}>
                    <User size={14} />
                  </div>
                ) : (
                  <Image src={AVATAR} alt="AIndrés" width={28} height={28} style={{ borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                )}

                <div style={{ maxWidth: '80%', position: 'relative' }}>
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: msg.role === 'user'
                      ? 'linear-gradient(135deg, #1a73e8, #6c5ce7)'
                      : 'var(--color-bg-secondary)',
                    color: msg.role === 'user' ? '#fff' : 'var(--color-text-primary)',
                    fontSize: 13, lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {msg.role === 'assistant' ? renderMarkdown(msg.text) : msg.text}
                  </div>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(msg.text);
                        setCopiedId(msg.id);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        marginTop: 4, padding: '3px 8px', borderRadius: 8,
                        border: 'none', background: 'transparent',
                        color: copiedId === msg.id ? '#34c759' : 'var(--color-text-tertiary)',
                        fontSize: 11, cursor: 'pointer',
                        fontFamily: 'var(--font-body)',
                        transition: 'color 0.2s',
                      }}
                      onMouseEnter={e => { if (copiedId !== msg.id) e.currentTarget.style.color = 'var(--color-primary)'; }}
                      onMouseLeave={e => { if (copiedId !== msg.id) e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
                    >
                      {copiedId === msg.id ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Image src={AVATAR} alt="AIndrés" width={28} height={28} style={{ borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                <div style={{
                  padding: '10px 14px', borderRadius: '16px 16px 16px 4px',
                  background: 'var(--color-bg-secondary)',
                  display: 'flex', alignItems: 'center', gap: 8,
                  color: 'var(--color-text-tertiary)', fontSize: 13,
                }}>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  Analizando datos...
                </div>
              </div>
            )}

            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 12,
                background: 'rgba(255, 59, 48, 0.08)',
                color: 'var(--color-danger)', fontSize: 12,
                textAlign: 'center',
              }}>
                ⚠️ {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '12px 16px', borderTop: '1px solid var(--color-border-light)',
            display: 'flex', gap: 8, alignItems: 'center',
            flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregunta sobre la liga..."
              disabled={isLoading}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 12,
                border: '1px solid var(--color-border-light)',
                background: 'var(--color-bg-secondary)',
                fontSize: 13, fontFamily: 'var(--font-body)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#1a73e8'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border-light)'; }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              style={{
                width: 38, height: 38, borderRadius: 12,
                background: input.trim() && !isLoading
                  ? 'linear-gradient(135deg, #1a73e8, #6c5ce7)'
                  : 'var(--color-bg-secondary)',
                color: input.trim() && !isLoading ? '#fff' : 'var(--color-text-tertiary)',
                border: 'none', cursor: input.trim() && !isLoading ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Animations */}
      <style jsx global>{`
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
