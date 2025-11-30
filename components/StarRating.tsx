import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  initialRating?: number;
  onRate?: (rating: number) => void;
  readonly?: boolean;
  size?: number;
}

const StarRating: React.FC<StarRatingProps> = ({ 
  initialRating = 0, 
  onRate, 
  readonly = false,
  size = 20
}) => {
  const [hoverRating, setHoverRating] = useState(0);
  const rating = initialRating;

  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="flex gap-1">
      {stars.map((star) => {
        const isFilled = readonly ? star <= rating : star <= (hoverRating || rating);
        
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            className={`${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform`}
            onMouseEnter={() => !readonly && setHoverRating(star)}
            onMouseLeave={() => !readonly && setHoverRating(0)}
            onClick={() => !readonly && onRate?.(star)}
          >
            <Star 
              size={size} 
              fill={isFilled ? "#d4af37" : "transparent"} 
              color={isFilled ? "#d4af37" : "#6b7280"} 
              className="transition-colors"
            />
          </button>
        );
      })}
    </div>
  );
};

export default StarRating;