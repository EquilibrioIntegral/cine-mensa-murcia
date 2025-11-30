import React, { useState, useEffect } from 'react';
import { generateSecurityQuiz, validateSecurityQuiz } from '../services/geminiService';
import { Loader2, ShieldAlert, CheckCircle, XCircle } from 'lucide-react';

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  movieTitle: string;
  onSuccess: () => void;
}

const QuizModal: React.FC<QuizModalProps> = ({ isOpen, onClose, movieTitle, onSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [questions, setQuestions] = useState<{ question: string }[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{ passed: boolean; reason: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setResult(null);
      setAnswers({});
      generateSecurityQuiz(movieTitle)
        .then(qs => {
            setQuestions(qs);
            setLoading(false);
        })
        .catch(() => {
            // Fallback just close if error
            setLoading(false);
            onClose();
        });
    }
  }, [isOpen, movieTitle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidating(true);
    
    const qa = questions.map((q, idx) => ({
        question: q.question,
        answer: answers[idx] || "No sé"
    }));

    try {
        const validation = await validateSecurityQuiz(movieTitle, qa);
        setResult(validation);
        if (validation.passed) {
            setTimeout(() => {
                onSuccess();
            }, 2000);
        }
    } catch (e) {
        console.error(e);
    } finally {
        setValidating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
      <div className="bg-cine-gray w-full max-w-md rounded-xl border border-cine-gold/30 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
        
        {/* Header */}
        <div className="bg-black/40 p-6 border-b border-gray-800 text-center">
             <ShieldAlert className="mx-auto text-cine-gold mb-3" size={48} />
             <h3 className="text-xl font-bold text-white mb-1">Control de Audiencia</h3>
             <p className="text-sm text-gray-400">Demuestra que has visto <strong>"{movieTitle}"</strong></p>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {loading ? (
                <div className="text-center py-10">
                    <Loader2 className="animate-spin text-cine-gold mx-auto mb-4" size={32} />
                    <p className="text-gray-400">La IA está generando preguntas...</p>
                </div>
            ) : result ? (
                 <div className="text-center py-8 animate-fade-in">
                     {result.passed ? (
                         <>
                            <CheckCircle className="text-green-500 mx-auto mb-4" size={64} />
                            <h4 className="text-2xl font-bold text-white mb-2">¡Aprobado!</h4>
                            <p className="text-green-400 mb-6">{result.reason}</p>
                            <p className="text-gray-500 text-sm">Abriendo valoración...</p>
                         </>
                     ) : (
                         <>
                            <XCircle className="text-red-500 mx-auto mb-4" size={64} />
                            <h4 className="text-2xl font-bold text-white mb-2">Suspendido</h4>
                            <p className="text-red-400 mb-6">{result.reason}</p>
                            <button 
                                onClick={onClose}
                                className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-full font-bold transition-colors"
                            >
                                Volver a verla
                            </button>
                         </>
                     )}
                 </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    {questions.map((q, idx) => (
                        <div key={idx}>
                            <label className="block text-sm font-bold text-cine-gold mb-2">
                                {idx + 1}. {q.question}
                            </label>
                            <input 
                                type="text"
                                required
                                value={answers[idx] || ''}
                                onChange={(e) => setAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                                placeholder="Tu respuesta..."
                                className="w-full bg-black/40 border border-gray-700 rounded p-3 text-white focus:border-cine-gold outline-none text-sm transition-colors"
                            />
                        </div>
                    ))}
                    
                    <button 
                        type="submit"
                        disabled={validating}
                        className="w-full bg-cine-gold text-black font-bold py-3 rounded-lg hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {validating ? <Loader2 className="animate-spin" /> : null}
                        {validating ? 'Corrigiendo...' : 'Enviar Respuestas'}
                    </button>
                </form>
            )}
        </div>
      </div>
    </div>
  );
};

export default QuizModal;