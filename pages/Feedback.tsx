
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Bug, Lightbulb, Send, Check } from 'lucide-react';

const Feedback: React.FC = () => {
  const { sendFeedback, triggerAction } = useData();
  const [type, setType] = useState<'bug' | 'feature'>('bug');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    
    setSending(true);
    await sendFeedback(type, text);
    
    // Trigger Gamification Action
    triggerAction('feedback');
    
    setSending(false);
    setSent(true);
    setText('');
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Ayúdanos a Mejorar</h2>
          <p className="text-gray-400">¿Encontraste un error o tienes una idea genial? Cuéntanoslo.</p>
      </div>

      <div className="bg-cine-gray rounded-xl border border-gray-800 p-8 shadow-xl">
          {sent ? (
              <div className="text-center py-10 animate-fade-in">
                  <div className="bg-green-500/20 p-4 rounded-full w-fit mx-auto mb-4">
                      <Check className="text-green-500" size={48} />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">¡Recibido!</h3>
                  <p className="text-gray-400">Gracias por tu aporte. El administrador lo revisará pronto.</p>
              </div>
          ) : (
              <form onSubmit={handleSubmit}>
                  <div className="flex gap-4 mb-6">
                      <button
                        type="button"
                        onClick={() => setType('bug')}
                        className={`flex-1 p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${type === 'bug' ? 'bg-red-900/20 border-red-500 text-red-400' : 'bg-black/30 border-gray-700 text-gray-500 hover:bg-white/5'}`}
                      >
                          <Bug size={24} />
                          <span className="font-bold">Reportar Bug</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setType('feature')}
                        className={`flex-1 p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${type === 'feature' ? 'bg-yellow-900/20 border-yellow-500 text-yellow-400' : 'bg-black/30 border-gray-700 text-gray-500 hover:bg-white/5'}`}
                      >
                          <Lightbulb size={24} />
                          <span className="font-bold">Sugerir Mejora</span>
                      </button>
                  </div>

                  <div className="mb-6">
                      <label className="block text-gray-400 text-sm font-bold mb-2">
                          {type === 'bug' ? 'Describe el error (qué hacías, qué pasó...)' : 'Describe tu idea'}
                      </label>
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="w-full h-40 bg-black/40 border border-gray-700 rounded-xl p-4 text-white focus:border-cine-gold outline-none resize-none"
                        placeholder="Escribe aquí..."
                        required
                      />
                  </div>

                  <button
                    type="submit"
                    disabled={sending || !text.trim()}
                    className="w-full bg-cine-gold text-black font-bold py-4 rounded-xl hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                      {sending ? 'Enviando...' : <><Send size={18} /> Enviar Informe</>}
                  </button>
              </form>
          )}
      </div>
    </div>
  );
};

export default Feedback;
