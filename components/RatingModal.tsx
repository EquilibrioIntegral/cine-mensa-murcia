import React, { useState, useEffect } from 'react';
import { X, Check, EyeOff, AlertCircle } from 'lucide-react';
import { DetailedRating } from '../types';
import { MIN_REVIEW_WORDS } from '../constants';

interface RatingModalProps {
  movieTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: DetailedRating, comment: string, spoiler?: string) => void;
  initialRating?: DetailedRating;
  initialComment?: string;
  initialSpoiler?: string;
}

const RatingModal: React.FC<RatingModalProps> = ({ 
  movieTitle, 
  isOpen, 
  onClose, 
  onSubmit,
  initialRating,
  initialComment = '',
  initialSpoiler = ''
}) => {
  const [categories, setCategories] = useState({
    script: 5,
    direction: 5,
    photography: 5,
    acting: 5,
    soundtrack: 5,
    enjoyment: 5
  });
  const [comment, setComment] = useState('');
  const [spoiler, setSpoiler] = useState('');
  const [showSpoilerInput, setShowSpoilerInput] = useState(false);

  // Sync state when modal opens or props change
  useEffect(() => {
    if (isOpen) {
        if (initialRating) {
            setCategories({
                script: initialRating.script,
                direction: initialRating.direction,
                photography: initialRating.photography,
                acting: initialRating.acting,
                soundtrack: initialRating.soundtrack,
                enjoyment: initialRating.enjoyment
            });
        } else {
            // Reset to defaults if new rating
            setCategories({
                script: 5, direction: 5, photography: 5, acting: 5, soundtrack: 5, enjoyment: 5
            });
        }
        setComment(initialComment || '');
        setSpoiler(initialSpoiler || '');
        setShowSpoilerInput(!!initialSpoiler);
    }
  }, [isOpen, initialRating, initialComment, initialSpoiler]);

  if (!isOpen) return null;

  const handleChange = (key: keyof typeof categories, value: string) => {
    setCategories(prev => ({ ...prev, [key]: parseInt(value) }));
  };

  const calculateAverage = () => {
    const sum = (Object.values(categories) as number[]).reduce((a, b) => a + b, 0);
    return parseFloat((sum / 6).toFixed(1));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const detailed: DetailedRating = {
      ...categories,
      average: calculateAverage()
    };
    onSubmit(detailed, comment, spoiler);
    onClose();
  };

  const labels: Record<string, string> = {
    script: 'Guion',
    direction: 'Dirección',
    photography: 'Fotografía',
    acting: 'Actuación',
    soundtrack: 'Banda Sonora',
    enjoyment: 'Disfrute Personal'
  };

  const average = calculateAverage();
  const isEditing = !!initialRating;
  // If editing but no previous comment/spoiler, it's effectively adding a review
  const isAddingReview = isEditing && !initialComment && !initialSpoiler;

  // Validation Logic
  const words = comment.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const hasParagraphs = comment.trim().includes('\n');
  
  // If comment is empty, allow submission (rating only). 
  // If comment has content, enforce rules.
  const hasContent = wordCount > 0;
  const isValidLength = !hasContent || (wordCount >= MIN_REVIEW_WORDS && hasParagraphs);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-cine-gray w-full max-w-lg rounded-xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-black/20">
          <h3 className="text-xl font-bold text-white truncate pr-4">
            {isAddingReview ? 'Añadir Reseña' : isEditing ? 'Editar Valoración' : 'Valorar'}: {movieTitle}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar">
          <div className="space-y-6 mb-6">
            {Object.entries(categories).map(([key, value]) => {
              const numericValue = value as number;
              return (
              <div key={key}>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-bold text-gray-300 uppercase tracking-wide">
                    {labels[key]}
                  </label>
                  <span className={`font-bold ${numericValue >= 8 ? 'text-cine-gold' : numericValue >= 5 ? 'text-white' : 'text-red-400'}`}>
                    {numericValue}
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="10" 
                  step="1"
                  value={numericValue}
                  onChange={(e) => handleChange(key as any, e.target.value)}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cine-gold"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>0</span>
                  <span>5</span>
                  <span>10</span>
                </div>
              </div>
            )})}
          </div>

          <div className="mb-6 space-y-4">
             <div>
                 <div className="flex justify-between items-end mb-2">
                     <label className="block text-sm font-bold text-gray-300 uppercase tracking-wide">
                       Comentario Público
                     </label>
                     {hasContent && (
                         <span className={`text-xs font-bold ${isValidLength ? 'text-green-500' : 'text-red-500'}`}>
                             {wordCount} / {MIN_REVIEW_WORDS} palabras
                         </span>
                     )}
                 </div>
                 <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={`¿Qué te ha parecido? (Mínimo ${MIN_REVIEW_WORDS} palabras y 2 párrafos)`}
                    className={`w-full bg-black/30 border rounded p-3 text-white h-32 focus:outline-none transition-colors ${hasContent && !isValidLength ? 'border-red-500 focus:border-red-500' : 'border-gray-600 focus:border-cine-gold'}`}
                 />
                 {hasContent && !isValidLength && (
                     <div className="mt-2 text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-900/50 flex items-start gap-2">
                         <AlertCircle size={14} className="mt-0.5 flex-shrink-0"/>
                         <span>
                             Para publicar una reseña escrita, debes cumplir los estándares de calidad:
                             <ul className="list-disc pl-4 mt-1 space-y-1">
                                 <li className={wordCount >= MIN_REVIEW_WORDS ? 'text-green-400' : ''}>Mínimo {MIN_REVIEW_WORDS} palabras</li>
                                 <li className={hasParagraphs ? 'text-green-400' : ''}>Mínimo 2 párrafos (usa Intro)</li>
                             </ul>
                         </span>
                     </div>
                 )}
             </div>
             
             <div className="border-t border-gray-700 pt-4">
                 <button 
                    type="button"
                    onClick={() => setShowSpoilerInput(!showSpoilerInput)}
                    className="flex items-center gap-2 text-red-400 font-bold hover:text-red-300 transition-colors text-sm mb-2"
                 >
                     <EyeOff size={16} /> {showSpoilerInput ? 'Ocultar sección de Spoilers' : 'Añadir Zona de Spoilers'}
                 </button>
                 
                 {showSpoilerInput && (
                     <div className="animate-fade-in bg-red-900/10 border border-red-900/50 p-3 rounded-lg">
                         <p className="text-xs text-red-400 mb-2">
                             Este texto <strong>solo será visible</strong> para usuarios que también hayan marcado esta película como "Vista".
                         </p>
                         <textarea
                            value={spoiler}
                            onChange={(e) => setSpoiler(e.target.value)}
                            placeholder="Aquí puedes hablar libremente del final, giros de guion..."
                            className="w-full bg-black/30 border border-red-900/50 rounded p-3 text-white h-24 focus:border-red-500 outline-none"
                         />
                     </div>
                 )}
             </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-700">
             <div className="flex flex-col">
                <span className="text-sm text-gray-400">Nota Final</span>
                <span className={`text-3xl font-bold ${average >= 8 ? 'text-cine-gold' : 'text-white'}`}>
                    {average} <span className="text-sm text-gray-500 font-normal">/ 10</span>
                </span>
             </div>
             <button 
                type="submit"
                disabled={!isValidLength}
                className="bg-cine-gold text-cine-dark px-8 py-3 rounded-lg font-bold hover:bg-white transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
             >
                <Check size={20} /> {isEditing ? 'Actualizar' : 'Guardar'}
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RatingModal;