import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    signInAnonymously,
    signInWithCustomToken,
    updateProfile
} from 'firebase/auth';
import {
    getFirestore,
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    doc,
    setDoc,
    getDoc
} from 'firebase/firestore';

function App() {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [currentUserName, setCurrentUserName] = useState('');
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [authError, setAuthError] = useState('');
    const messagesEndRef = useRef(null);

    // Initialize Firebase and set up auth listener
    useEffect(() => {
        try {
            // Access Firebase config from Netlify environment variables
            // Ensure the string is correctly JSON-parsed, especially if it includes newlines or special characters
            const firebaseConfig = JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG || '{"apiKey": "AIzaSyAO2BpX-H8rG8Q1UD-q_X7jzshYgcmiB3w", "authDomain": "appgruo.firebaseapp.com", "projectId": "appgruo", "storageBucket": "appgruo.firebasestorage.app", "messagingSenderId": "738965854785", "appId": "1:738965854785:web:cc3442eb375caf692684c0", "measurementId": "G-SQXLRV1R1L"}');
            const appId = process.env.REACT_APP_APP_ID || '1:738965854785:web:cc3442eb375caf692684c0'; // Use REACT_APP_APP_ID and ensure no stray characters

            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const authentication = getAuth(app);

            setDb(firestore);
            setAuth(authentication);

            const unsubscribeAuth = onAuthStateChanged(authentication, async (user) => {
                if (user) {
                    setCurrentUser(user);
                    setCurrentUserId(user.uid);
                    // Fetch custom username from Firestore
                    const userDocRef = doc(firestore, 'artifacts', appId, 'users', user.uid);
                    try {
                        const userDocSnap = await getDoc(userDocRef);
                        if (userDocSnap.exists()) {
                            setCurrentUserName(userDocSnap.data().username || user.displayName || 'Anonymous');
                        } else {
                            setCurrentUserName(user.displayName || 'Anonymous');
                        }
                    } catch (error) {
                        console.error("Error fetching user document:", error);
                        setCurrentUserName(user.displayName || 'Anonymous');
                    }
                    setLoading(false);
                    setAuthError('');
                } else {
                    // Attempt to sign in anonymously if no user and no initial token from Canvas
                    // For Netlify deployment, __initial_auth_token will not exist, so we default to anonymous sign-in or prompt login
                    try {
                        await signInAnonymously(authentication); // Use anonymous sign-in by default
                    } catch (error) {
                        console.error("Firebase anonymous sign-in error:", error);
                        setLoading(false);
                    }
                }
            });

            return () => unsubscribeAuth();
        } catch (error) {
            console.error("Failed to initialize Firebase:", error);
            setLoading(false);
        }
    }, []); // Empty dependency array means this runs once on mount

    // Fetch messages from Firestore (only if authenticated)
    useEffect(() => {
        if (!db || !currentUserId) {
            setMessages([]);
            return;
        }

        const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
        const messagesCollectionPath = `artifacts/${appId}/public/data/messages`;
        const q = query(collection(db, messagesCollectionPath), orderBy('timestamp'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedMessages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(fetchedMessages);
        }, (error) => {
            console.error("Error fetching messages:", error);
        });

        return () => unsubscribe();
    }, [db, currentUserId]);

    // Scroll to the latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleRegister = async (e) => {
        e.preventDefault();
        setAuthError('');
        if (!auth || !db) return;

        try {
            setLoading(true);
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
            const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid);
            await setDoc(userDocRef, { username: username, email: email });

            await updateProfile(user, { displayName: username });

            setCurrentUser(user);
            setCurrentUserId(user.uid);
            setCurrentUserName(username);
            setLoading(false);
        } catch (error) {
            setAuthError(error.message);
            setLoading(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setAuthError('');
        if (!auth || !db) return;

        try {
            setLoading(true);
            await signInWithEmailAndPassword(auth, email, password);
            setLoading(false);
        } catch (error) {
            setAuthError(error.message);
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        setAuthError('');
        if (!auth) return;
        try {
            await signOut(auth);
            setMessages([]);
        } catch (error) {
            console.error("Error logging out:", error);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (newMessage.trim() === '' || !db || !currentUserId) {
            return;
        }

        try {
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
            const messagesCollectionPath = `artifacts/${appId}/public/data/messages`;

            await addDoc(collection(db, messagesCollectionPath), {
                text: newMessage,
                senderId: currentUserId,
                senderName: currentUserName,
                timestamp: serverTimestamp(),
            });
            setNewMessage('');
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 font-inter">
                <div className="text-xl font-semibold text-gray-700">Loading application...</div>
            </div>
        );
    }

    // Render Login/Register forms if not authenticated
    if (!currentUser) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-emerald-500 to-green-700 font-inter">
                <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md">
                    <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
                        {isRegistering ? 'Register' : 'Login'} to WhatsApp Clone
                    </h2>
                    {authError && <p className="text-red-600 text-center mb-4">{authError}</p>}
                    <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
                        {isRegistering && (
                            <div>
                                <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="username">
                                    Username
                                </label>
                                <input
                                    type="text"
                                    id="username"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                                    placeholder="Enter your username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="email">
                                Email
                            </label>
                            <input
                                type="email"
                                id="email"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="password">
                                Password
                            </label>
                            <input
                                type="password"
                                id="password"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition duration-200 ease-in-out shadow-md"
                        >
                            {isRegistering ? 'Register' : 'Login'}
                        </button>
                    </form>
                    <div className="text-center mt-6">
                        <button
                            onClick={() => setIsRegistering(!isRegistering)}
                            className="text-emerald-600 hover:underline text-sm font-semibold"
                        >
                            {isRegistering ? 'Already have an account? Login' : "Don't have an account? Register"}
                        </button>
                    </div>
                </div>
                {/* Tailwind CSS CDN */}
                <script src="https://cdn.tailwindcss.com"></script>
                <style
                    dangerouslySetInnerHTML={{
                        __html: `
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                body {
                  font-family: 'Inter', sans-serif;
                }
              `
                    }}
                />
            </div>
        );
    }

    // Render Chat interface if authenticated
    return (
        <div className="flex flex-col h-screen bg-gray-100 font-inter">
            {/* Header */}
            <header className="bg-emerald-600 text-white p-4 shadow-md flex items-center justify-between rounded-b-lg">
                <h1 className="text-xl font-bold">WhatsApp Clone</h1>
                <div className="flex items-center space-x-3">
                    {currentUserName && (
                        <span className="text-sm bg-emerald-700 px-3 py-1 rounded-full">
                Logged in as: {currentUserName}
              </span>
                    )}
                    <button
                        onClick={handleLogout}
                        className="px-3 py-1 bg-red-500 text-white rounded-full text-sm font-semibold hover:bg-red-600 transition duration-200"
                    >
                        Logout
                    </button>
                </div>
            </header>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 md:p-6 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="text-center text-gray-500 mt-10">
                        Start a conversation! No messages yet.
                    </div>
                )}
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${
                            msg.senderId === currentUserId ? 'justify-end' : 'justify-start'
                        }`}
                    >
                        <div
                            className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-lg shadow-md ${
                                msg.senderId === currentUserId
                                    ? 'bg-emerald-200 text-gray-800 rounded-br-none'
                                    : 'bg-white text-gray-800 rounded-bl-none'
                            }`}
                        >
                            <div className="font-semibold text-xs text-gray-600 mb-1">
                                {msg.senderId === currentUserId ? 'You' : (msg.senderName || `User ${msg.senderId ? msg.senderId.substring(0, 8) + '...' : 'Unknown'}`)}
                            </div>
                            <p className="text-sm break-words">{msg.text}</p>
                            {msg.timestamp && (
                                <div className="text-right text-xs text-gray-500 mt-1">
                                    {new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200 flex items-center rounded-t-lg shadow-inner">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 p-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 transition duration-200 ease-in-out"
                />
                <button
                    type="submit"
                    className="ml-3 px-5 py-3 bg-emerald-500 text-white rounded-full font-semibold hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition duration-200 ease-in-out shadow-md"
                >
                    Send
                </button>
            </form>

            {/* Tailwind CSS CDN and custom styles */}
            <script src="https://cdn.tailwindcss.com"></script>
            <style
                dangerouslySetInnerHTML={{
                    __html: `
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
              body {
                font-family: 'Inter', sans-serif;
              }
              .custom-scrollbar::-webkit-scrollbar {
                width: 8px;
              }
              .custom-scrollbar::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 10px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 10px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: #555;
              }
            `
                }}
            />
        </div>
    );
}

export default App;
