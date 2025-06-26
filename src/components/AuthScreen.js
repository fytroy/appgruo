import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { XCircle } from 'lucide-react'; // Import XCircle for error messages

function AuthScreen({ auth, db, setAuthError, authError }) {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [loadingAuth, setLoadingAuth] = useState(false); // State to manage loading during auth operations

    const handleRegister = async (e) => {
        e.preventDefault();
        setAuthError(''); // Clear any previous errors
        setLoadingAuth(true); // Start loading

        if (!auth || !db) {
            setAuthError('Firebase services not initialized. Please refresh the page.');
            setLoadingAuth(false);
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Ensure appId is available, fallback if not
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
            const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid);

            // Create a user document in Firestore with username and email
            await setDoc(userDocRef, { username: username, email: email, createdAt: serverTimestamp() });

            // Update Firebase Auth profile with display name (username)
            await updateProfile(user, { displayName: username });

            // The onAuthStateChanged listener in App.js will detect this user login
            // and update the global application state (currentUser, currentUserName).
        } catch (error) {
            // Display specific error messages from Firebase Auth
            let errorMessage = error.message;
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'This email is already in use. Try logging in or use a different email.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email address format.';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Password should be at least 6 characters.';
            }
            setAuthError(errorMessage);
        } finally {
            setLoadingAuth(false); // Stop loading regardless of success or failure
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setAuthError(''); // Clear any previous errors
        setLoadingAuth(true); // Start loading

        if (!auth || !db) {
            setAuthError('Firebase services not initialized. Please refresh the page.');
            setLoadingAuth(false);
            return;
        }

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // The onAuthStateChanged listener in App.js will detect this user login
            // and update the global application state.
        } catch (error) {
            // Display specific error messages from Firebase Auth
            let errorMessage = error.message;
            if (error.code === 'auth/invalid-credential') { // More generic for invalid email/password
                errorMessage = 'Invalid email or password. Please check your credentials.';
            } else if (error.code === 'auth/user-not-found') {
                errorMessage = 'No user found with this email. Please register.';
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = 'Incorrect password. Please try again.';
            }
            setAuthError(errorMessage);
        } finally {
            setLoadingAuth(false); // Stop loading
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white font-inter p-4">
            <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md border border-gray-700">
                <h2 className="text-3xl font-extrabold text-center text-emerald-400 mb-6">
                    {isRegistering ? 'Join Slack Clone' : 'Welcome Back!'}
                </h2>
                {authError && (
                    <p className="text-red-500 text-center mb-4 text-sm flex items-center justify-center">
                        <XCircle className="h-4 w-4 mr-2" /> {authError}
                    </p>
                )}
                <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-5">
                    {isRegistering && (
                        <div>
                            <label className="block text-gray-300 text-sm font-semibold mb-2" htmlFor="username">
                                Username
                            </label>
                            <input
                                type="text"
                                id="username"
                                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition duration-200 ease-in-out"
                                placeholder="Choose your username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>
                    )}
                    <div>
                        <label className="block text-gray-300 text-sm font-semibold mb-2" htmlFor="email">
                            Email
                        </label>
                        <input
                            type="email"
                            id="email"
                            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition duration-200 ease-in-out"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-gray-300 text-sm font-semibold mb-2" htmlFor="password">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition duration-200 ease-in-out"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition duration-200 ease-in-out shadow-lg transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loadingAuth} // Disable button when loading
                    >
                        {loadingAuth ? (isRegistering ? 'Registering...' : 'Logging In...') : (isRegistering ? 'Register' : 'Login')}
                    </button>
                </form>
                <div className="text-center mt-6">
                    <button
                        onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }} // Clear error on toggle
                        className="text-emerald-400 hover:text-emerald-300 hover:underline text-sm font-semibold transition duration-200"
                    >
                        {isRegistering ? 'Already have an account? Login here.' : "Don't have an account? Create one."}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AuthScreen;
