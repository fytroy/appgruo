import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

// IMPORTANT: These imports MUST correctly point to your components.
// They assume 'AuthScreen.js' and 'SlackApp.js' are directly inside a folder named 'components'
// which is itself inside your 'src' folder.
import AuthScreen from './components/AuthScreen';
import SlackApp from './components/SlackApp';

function App() {
    const [currentUser, setCurrentUser] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [currentUserName, setCurrentUserName] = useState('');
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState('');

    // Initialize Firebase and set up auth listener
    useEffect(() => {
        try {
            // Access Firebase config from environment variables (e.g., in Netlify)
            // For local development, you will temporarily hardcode this in step 4 below.
            const firebaseConfig = JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG || '{apiKey: "AIzaSyAO2BpX-H8rG8Q1UD-q_X7jzshYgcmiB3w",
                  authDomain: "appgruo.firebaseapp.com",
                  projectId: "appgruo",
                  storageBucket: "appgruo.firebasestorage.app",
                  messagingSenderId: "738965854785",
                  appId: "1:738965854785:web:cc3442eb375caf692684c0",
                  measurementId: "G-SQXLRV1R1L"};
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';

            // Crucial check: if config is missing, stop and show error
            if (Object.keys(firebaseConfig).length === 0 || !firebaseConfig.projectId) {
                console.error("Firebase configuration environment variable (REACT_APP_FIREBASE_CONFIG) is missing or incomplete. Please set it.");
                setAuthError("App configuration missing. Please ensure REACT_APP_FIREBASE_CONFIG is set correctly and includes 'projectId'.");
                setLoading(false);
                return;
            }

            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const authentication = getAuth(app);

            setDb(firestore);
            setAuth(authentication);

            // Listen for authentication state changes
            const unsubscribeAuth = onAuthStateChanged(authentication, async (user) => {
                if (user) {
                    setCurrentUser(user);
                    setCurrentUserId(user.uid);
                    // Attempt to fetch user's custom username from Firestore, or create a default profile
                    const userDocRef = doc(firestore, 'artifacts', appId, 'users', user.uid);
                    try {
                        const userDocSnap = await getDoc(userDocRef);
                        if (userDocSnap.exists()) {
                            setCurrentUserName(userDocSnap.data().username || user.displayName || 'Anonymous User');
                        } else {
                            // Create a basic user document if it doesn't exist
                            await setDoc(userDocRef, {
                                username: user.displayName || `User_${user.uid.substring(0, 5)}`,
                                email: user.email,
                                createdAt: new Date()
                            }, { merge: true });
                            setCurrentUserName(user.displayName || `User_${user.uid.substring(0, 5)}`);
                        }
                    } catch (error) {
                        console.error("Error fetching or creating user document:", error);
                        setAuthError("Failed to load user data.");
                        setCurrentUserName(user.displayName || 'Anonymous User'); // Fallback username
                    }
                    setLoading(false);
                    setAuthError(''); // Clear any previous auth errors on successful login
                } else {
                    // If no user is authenticated, clear user state and stop loading
                    setLoading(false);
                    setCurrentUser(null);
                    setCurrentUserId(null);
                    setCurrentUserName('');
                }
            });

            return () => unsubscribeAuth(); // Clean up the listener when component unmounts
        } catch (error) {
            console.error("Failed to initialize Firebase or parse config:", error);
            setAuthError("Failed to initialize the app. Check console for details.");
            setLoading(false);
        }
    }, []); // Empty dependency array ensures this runs only once on mount

    // Display a loading spinner while Firebase initializes
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-200 font-inter text-xl">
                <div className="flex items-center space-x-3">
                    <svg className="animate-spin h-6 w-6 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Loading Slack Clone...</span>
                </div>
            </div>
        );
    }

    // Render AuthScreen or SlackApp based on authentication status
    return (
        <div className="h-screen flex flex-col font-inter">
            {currentUser ? (
                <SlackApp
                    db={db}
                    auth={auth}
                    currentUserId={currentUserId}
                    currentUserName={currentUserName}
                    setAuthError={setAuthError}
                />
            ) : (
                <AuthScreen
                    auth={auth}
                    db={db}
                    setAuthError={setAuthError}
                    authError={authError}
                />
            )}
            {/* Tailwind CSS CDN and global custom styles are injected here */}
            <script src="https://cdn.tailwindcss.com"></script>
            <style
                dangerouslySetInnerHTML={{
                    __html: `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              margin: 0;
              overscroll-behavior: none; /* Prevent accidental pull-to-refresh on mobile */
            }
            /* Custom Scrollbar */
            .custom-scrollbar::-webkit-scrollbar {
              width: 8px;
              height: 8px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: #2a2a2e;
              border-radius: 10px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: #555;
              border-radius: 10px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: #777;
            }
            /* Chat background pattern */
            .bg-chat-pattern {
              background-image: url('data:image/svg+xml,%3Csvg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath fill="%23e0e0e0" fill-opacity="0.05" d="M16 0H0V16h16V0zM1 1h14v14H1V1z"/%3E%3C/svg%3E');
              background-size: 8px 8px;
              background-color: #f0f2f5;
            }
            /* Dark mode for chat pattern */
            @media (prefers-color-scheme: dark) {
              .bg-chat-pattern {
                background-image: url('data:image/svg+xml,%3Csvg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath fill="%231a1a1a" fill-opacity="0.15" d="M16 0H0V16h16V0zM1 1h14v14H1V1z"/%3E%3C/svg%3E');
                background-color: #1a1a1a;
              }
            }
          `
                }}
            />
        </div>
    );
}

export default App;
