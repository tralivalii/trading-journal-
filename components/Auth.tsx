import React, { useState } from 'react';
import { User } from '../types';
import * as db from '../services/databaseService';

interface AuthProps {
  onAuthSuccess: (user: User) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const Auth: React.FC<AuthProps> = ({ onAuthSuccess, users, setUsers }) => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // State for the mock Google Sign-In modal
  const [isGoogleModalOpen, setGoogleModalOpen] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('user@google.com');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    if (isLoginView) {
      const user = users.find(u => u.email === email && u.password === password);
      if (user) {
        onAuthSuccess({ email: user.email });
      } else {
        setError('Invalid credentials.');
      }
    } else {
      if (users.some(u => u.email === email)) {
        setError('User with this email already exists.');
        return;
      }
      const newUser = { email, password };
      db.initializeUser(newUser.email).then(() => {
        setUsers(prev => [...prev, newUser]);
        onAuthSuccess({ email: newUser.email });
      });
    }
  };
  
  const handleGuestLogin = async () => {
    setError('');
    const guestEmail = 'guest@tradingjournal.app';
    const guestPassword = 'password';

    try {
        await db.initializeUser(guestEmail);
        const userExists = users.some(u => u.email === guestEmail);
        if (!userExists) {
            const newUser = { email: guestEmail, password: guestPassword };
            setUsers(prev => [...prev, newUser]);
        }
        onAuthSuccess({ email: guestEmail });
    } catch (e) {
        setError('Could not log in as guest. Please try again.');
        console.error(e);
    }
  };

  const handleGoogleSignInClick = () => {
    setError('');
    setGoogleModalOpen(true);
  };
  
  const handleMockGoogleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (googleEmail) {
        setError('');
        db.initializeUser(googleEmail).then(() => {
            const userExists = users.some(u => u.email === googleEmail);
            if (!userExists) {
                const newUser = { email: googleEmail };
                setUsers(prev => [...prev, newUser]);
            }
            onAuthSuccess({ email: googleEmail });
            setGoogleModalOpen(false);
        });
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700">
        <h2 className="text-3xl font-bold text-center text-white mb-6">{isLoginView ? 'Sign In' : 'Create Account'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
            />
          </div>
          <div>
            <label htmlFor="password"className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
            />
          </div>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {isLoginView ? 'Sign In' : 'Sign Up'}
          </button>
        </form>
        
        <div className="mt-4">
            <button
                type="button"
                onClick={handleGuestLogin}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors"
            >
                Continue as Guest (Test Account)
            </button>
        </div>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-600" /></div>
            <div className="relative flex justify-center text-sm"><span className="px-2 bg-gray-800 text-gray-400">Or continue with</span></div>
          </div>
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={handleGoogleSignInClick}
              className="w-full flex items-center justify-center py-2 px-4 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-white bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#4285F4" d="M48 24c0-1.66-0.14-3.26-0.41-4.82H24v9.11h13.43c-0.58 2.96-2.26 5.48-4.78 7.18v5.93h7.64C45.33 39.73 48 32.38 48 24z" />
                <path fill="#34A853" d="M24 48c6.5 0 11.97-2.16 15.95-5.82l-7.64-5.93c-2.16 1.45-4.92 2.3-8.31 2.3-6.39 0-11.79-4.29-13.71-10.04H2.62v6.14C6.54 42.42 14.61 48 24 48z" />
                <path fill="#FBBC05" d="M10.29 28.71c-0.48-1.45-0.76-3-0.76-4.6s0.27-3.15 0.76-4.6V13.38H2.62C0.95 16.53 0 20.14 0 24s0.95 7.47 2.62 10.62L10.29 28.71z" />
                <path fill="#EA4335" d="M24 9.6c3.51 0 6.61 1.2 9.09 3.51l6.78-6.78C35.97 2.16 30.5 0 24 0 14.61 0 6.54 5.58 2.62 13.38l7.67 6.14C12.21 13.89 17.61 9.6 24 9.6z" />
              </svg>
              Sign in with Google
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-400">
          {isLoginView ? "Don't have an account?" : "Already have an account?"}{' '}
          <button onClick={() => { setIsLoginView(!isLoginView); setError(''); }} className="font-medium text-blue-500 hover:text-blue-400">
            {isLoginView ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>

      {isGoogleModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center backdrop-blur-sm p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-sm border border-gray-700">
                <div className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 text-center">Simulate Google Sign-In</h3>
                    <p className="text-sm text-gray-400 mb-4 text-center">Enter an email address to sign in or create an account.</p>
                    <form onSubmit={handleMockGoogleLogin}>
                        <input
                            type="email"
                            value={googleEmail}
                            onChange={(e) => setGoogleEmail(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                            required
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <button type="button" onClick={() => setGoogleModalOpen(false)} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors text-sm">Cancel</button>
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors text-sm">Sign In</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Auth;