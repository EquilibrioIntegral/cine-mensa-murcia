
import React from 'react';
import { useData } from '../context/DataContext';
import { SHOP_ITEMS } from '../constants';
import { ShoppingBag, Lock, Check, Ticket } from 'lucide-react';
import RankBadge from '../components/RankBadge';

const Shop: React.FC = () => {
  const { user, spendCredits } = useData();

  if (!user) return null;

  const handlePurchase = async (item: any) => {
      if (user.credits < item.cost) return;
      if (user.level < item.minLevel) return;
      if (user.inventory?.includes(item.id)) return;

      const success = await spendCredits(item.cost, item.id);
      if (success) {
          // Additional logic (e.g., play sound)
      }
  };

  return (
    <div className="container mx-auto px-4 py-8 pb-20">
      <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-3">
              <ShoppingBag className="text-cine-gold" size={32} /> Taquilla de Premios
          </h2>
          <p className="text-gray-400 mb-6">Canjea tus Visiones de Taquilla por recompensas exclusivas.</p>
          
          <div className="inline-flex items-center gap-2 bg-black/40 border border-cine-gold px-6 py-3 rounded-full">
              <Ticket className="text-cine-gold" size={24} />
              <span className="text-2xl font-black text-white">{user.credits || 0}</span>
              <span className="text-sm text-gray-400 uppercase font-bold tracking-wider">Créditos</span>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {SHOP_ITEMS.map(item => {
              const isOwned = user.inventory?.includes(item.id);
              const isLocked = user.level < item.minLevel;
              const canAfford = user.credits >= item.cost;
              const Icon = item.icon;

              return (
                  <div key={item.id} className={`relative bg-cine-gray rounded-xl overflow-hidden border transition-all ${isOwned ? 'border-green-500/50 opacity-70' : isLocked ? 'border-gray-800 opacity-50' : 'border-gray-700 hover:border-cine-gold shadow-lg hover:scale-[1.02]'}`}>
                      <div className="p-6 flex flex-col h-full">
                          <div className="flex justify-between items-start mb-4">
                              <div className={`p-3 rounded-xl ${isOwned ? 'bg-green-500/20 text-green-500' : 'bg-black/40 text-cine-gold'}`}>
                                  <Icon size={32} />
                              </div>
                              {isOwned && (
                                  <span className="bg-green-500/20 text-green-500 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                                      <Check size={12}/> EN PROPIEDAD
                                  </span>
                              )}
                          </div>
                          
                          <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                          <p className="text-gray-400 text-sm mb-6 flex-grow">{item.description}</p>
                          
                          <div className="mt-auto">
                              {isLocked ? (
                                  <div className="bg-black/40 py-3 rounded-lg flex items-center justify-center gap-2 text-gray-500 font-bold text-sm">
                                      <Lock size={16}/> Desbloquea en Nivel {item.minLevel}
                                  </div>
                              ) : isOwned ? (
                                  <button disabled className="w-full bg-green-900/30 text-green-400 py-3 rounded-lg font-bold cursor-default">
                                      Comprado
                                  </button>
                              ) : (
                                  <button 
                                    onClick={() => handlePurchase(item)}
                                    disabled={!canAfford}
                                    className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${canAfford ? 'bg-cine-gold text-black hover:bg-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
                                  >
                                      <Ticket size={18}/> {item.cost}
                                  </button>
                              )}
                          </div>
                      </div>
                  </div>
              );
          })}
      </div>
    </div>
  );
};

export default Shop;
