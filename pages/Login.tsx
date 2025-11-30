
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Film } from 'lucide-react';

const Login: React.FC = () => {
  const { login, register } = useData();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    if (!email.includes('@')) {
        setMessage({ type: 'error', text: "Email inválido" });
        setLoading(false);
        return;
    }

    if (password.length < 6) {
        setMessage({ type: 'error', text: "La contraseña debe tener al menos 6 caracteres" });
        setLoading(false);
        return;
    }

    try {
        if (isRegistering) {
            if (!name) {
                setMessage({ type: 'error', text: "El nombre es obligatorio" });
                setLoading(false);
                return;
            }
            const result = await register(email, name, password);
            setMessage({ type: result.success ? 'success' : 'error', text: result.message });
            if (result.success && !result.message.includes('Administrador')) {
                // Stay on screen to show "Pending approval" message
            }
        } else {
            const result = await login(email, password);
            if (!result.success) {
                setMessage({ type: 'error', text: result.message });
            }
        }
    } catch (error: any) {
        setMessage({ type: 'error', text: "Error inesperado: " + error.message });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[url('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center">
      <div className="absolute inset-0 bg-cine-dark/90 backdrop-blur-sm"></div>
      
      <div className="relative z-10 w-full max-w-md p-8 bg-black/60 border border-gray-800 rounded-2xl shadow-2xl backdrop-blur-md">
        <div className="flex flex-col items-center mb-8">
            <div className="bg-cine-gold p-3 rounded-full mb-4">
                <Film size={32} className="text-black" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-wider text-center">
                CINE MENSA <br/><span className="text-cine-gold">MURCIA</span>
            </h1>
            <p className="text-gray-400 text-sm mt-2">Acceso Exclusivo para Socios</p>
        </div>

        {message && (
            <div className={`mb-4 p-3 rounded text-sm text-center ${message.type === 'error' ? 'bg-red-900/50 text-red-200 border border-red-800' : 'bg-green-900/50 text-green-200 border border-green-800'}`}>
                {message.text}
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
                <div>
                    <label className="block text-xs text-gray-400 uppercase font-bold mb-1">Nombre</label>
                    <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-gray-900/80 border border-gray-700 rounded p-3 text-white focus:border-cine-gold outline-none transition-colors"
                        placeholder="Tu nombre cinéfilo"
                        required={isRegistering}
                    />
                </div>
            )}
            <div>
                <label className="block text-xs text-gray-400 uppercase font-bold mb-1">Email</label>
                <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-900/80 border border-gray-700 rounded p-3 text-white focus:border-cine-gold outline-none transition-colors"
                    placeholder="usuario@gmail.com"
                    required
                />
            </div>
            <div>
                <label className="block text-xs text-gray-400 uppercase font-bold mb-1">Contraseña</label>
                <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-900/80 border border-gray-700 rounded p-3 text-white focus:border-cine-gold outline-none transition-colors"
                    placeholder="••••••••"
                    required
                />
            </div>

            <button 
                type="submit"
                disabled={loading}
                className="w-full bg-cine-gold text-black font-bold py-3 rounded hover:bg-white transition-colors mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? 'Procesando...' : (isRegistering ? 'Solicitar Registro' : 'Entrar al Cine')}
            </button>
        </form>

        <div className="mt-6 text-center">
            <button 
                onClick={() => { setIsRegistering(!isRegistering); setMessage(null); }}
                className="text-gray-400 text-sm hover:text-cine-gold underline"
            >
                {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿Nuevo socio? Solicita acceso'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
