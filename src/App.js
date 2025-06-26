import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    // signInAnonymously, // Anonymous sign-in might be less relevant with explicit user accounts
    // signInWithCustomToken, // Removed as it's not used in this deployment context
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
    getDoc,
    updateDoc,
    arrayUnion
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

    // New states for group management
    const [groups, setGroups] = useState([]);
    const [selectedGroupId, setSelectedGroupId] = useState(null); // Null means public chat, or a group ID
    const [selectedGroupName, setSelectedGroupName] = useState('Public Chat');
    const [newGroupName, setNewGroupName] = useState('');
    const [joinGroupId, setJoinGroupId] = useState('');
    const [showGroupModal, setShowGroupModal] = useState(false); // To show create/join group modal

    // Initialize Firebase and set up auth listener
    useEffect(() => {
        try {
            const firebaseConfig = JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG || '{ apiKey: "AIzaSyAO2BpX-H8rG8Q1UD-q_X7jzshYgcmiB3w",\n' +
                '  authDomain: "appgruo.firebaseapp.com",\n' +
                '  projectId: "appgruo",\n' +
                '  storageBucket: "appgruo.firebasestorage.app",\n' +
                '  messagingSenderId: "738965854785",\n' +
                '  appId: "1:738965854785:web:cc3442eb375caf692684c0",\n' +
                '  measurementId: "G-SQXLRV1R1L"}');
            const appId = process.env.REACT_APP_APP_ID || '1:738965854785:web:cc3442eb375caf692684c0';

            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const authentication = getAuth(app);

            setDb(firestore);
            setAuth(authentication);

            const unsubscribeAuth = onAuthStateChanged(authentication, async (user) => {
                if (user) {
                    setCurrentUser(user);
                    setCurrentUserId(user.uid);
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
                    // If no user is authenticated, user must login/register
                    setLoading(false);
                    setCurrentUser(null);
                    setCurrentUserId(null);
                    setCurrentUserName('');
                }
            });

            return () => unsubscribeAuth();
        } catch (error) {
            console.error("Failed to initialize Firebase:", error);
            setLoading(false);
        }
    }, []);

    // Fetch groups and messages based on selectedGroup
    useEffect(() => {
        if (!db || !currentUserId) {
            setMessages([]);
            setGroups([]);
            return;
        }

        const appId = process.env.REACT_APP_APP_ID || 'default-app-id';

        // Fetch groups the current user is a member of
        const groupsCollectionRef = collection(db, `artifacts/${appId}/public/data/groups`);
        const qGroups = query(groupsCollectionRef); // Fetch all groups for now, then filter client-side if needed for privacy
        const unsubscribeGroups = onSnapshot(qGroups, (snapshot) => {
            const fetchedGroups = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).filter(group => group.members && group.members.includes(currentUserId)); // Filter groups by current user's membership
            setGroups(fetchedGroups);

            // If no group is selected or selected group is no longer valid, default to public chat
            if (!selectedGroupId || !fetchedGroups.some(g => g.id === selectedGroupId)) {
                setSelectedGroupId(null);
                setSelectedGroupName('Public Chat');
            }
        }, (error) => {
            console.error("Error fetching groups:", error);
        });


        // Fetch messages for the selected chat (public or group)
        let messagesCollectionPath;
        if (selectedGroupId) {
            messagesCollectionPath = `artifacts/${appId}/public/data/groups/${selectedGroupId}/messages`;
        } else {
            messagesCollectionPath = `artifacts/${appId}/public/data/messages`; // Public chat
        }

        const qMessages = query(collection(db, messagesCollectionPath), orderBy('timestamp'));

        const unsubscribeMessages = onSnapshot(qMessages, (snapshot) => {
            const fetchedMessages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(fetchedMessages);
        }, (error) => {
            console.error("Error fetching messages:", error);
        });

        return () => {
            unsubscribeGroups();
            unsubscribeMessages();
        };
    }, [db, currentUserId, selectedGroupId]); // Re-run when db, currentUserId, or selectedGroupId changes

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
            await setDoc(userDocRef, { username: username, email: email, createdAt: serverTimestamp() });

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
            setGroups([]); // Clear groups on logout
            setSelectedGroupId(null);
            setSelectedGroupName('Public Chat');
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
            let messagesCollectionRef;

            if (selectedGroupId) {
                messagesCollectionRef = collection(db, `artifacts/${appId}/public/data/groups/${selectedGroupId}/messages`);
            } else {
                messagesCollectionRef = collection(db, `artifacts/${appId}/public/data/messages`); // Public chat
            }

            await addDoc(messagesCollectionRef, {
                text: newMessage,
                senderId: currentUserId,
                senderName: currentUserName,
                timestamp: serverTimestamp(),
                type: 'text' // Default message type
            });
            setNewMessage('');
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (newGroupName.trim() === '' || !db || !currentUserId) {
            return;
        }

        try {
            setLoading(true);
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
            const groupsCollectionRef = collection(db, `artifacts/${appId}/public/data/groups`);
            const newGroupRef = await addDoc(groupsCollectionRef, {
                name: newGroupName,
                createdAt: serverTimestamp(),
                createdBy: currentUserId,
                admin: [currentUserId], // Creator is the initial admin
                members: [currentUserId] // Creator is the initial member
            });
            setSelectedGroupId(newGroupRef.id);
            setSelectedGroupName(newGroupName);
            setNewGroupName('');
            setShowGroupModal(false);
            setLoading(false);
        } catch (error) {
            console.error("Error creating group:", error);
            setLoading(false);
        }
    };

    const handleJoinGroup = async (e) => {
        e.preventDefault();
        if (joinGroupId.trim() === '' || !db || !currentUserId) {
            return;
        }

        try {
            setLoading(true);
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
            const groupDocRef = doc(db, `artifacts/${appId}/public/data/groups`, joinGroupId);
            const groupDocSnap = await getDoc(groupDocRef);

            if (groupDocSnap.exists()) {
                const groupData = groupDocSnap.data();
                if (groupData.members && groupData.members.includes(currentUserId)) {
                    setAuthError('You are already a member of this group.');
                    setLoading(false);
                    return;
                }

                await updateDoc(groupDocRef, {
                    members: arrayUnion(currentUserId) // Add current user to members array
                });
                setSelectedGroupId(joinGroupId);
                setSelectedGroupName(groupData.name);
                setJoinGroupId('');
                setShowGroupModal(false);
                setLoading(false);
            } else {
                setAuthError('Group not found with this ID.');
                setLoading(false);
            }
        } catch (error) {
            console.error("Error joining group:", error);
            setLoading(false);
        }
    };

    const selectChat = (groupId, groupName) => {
        setSelectedGroupId(groupId);
        setSelectedGroupName(groupName);
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
                <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md border border-gray-200">
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
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 transition duration-200 ease-in-out"
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
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 transition duration-200 ease-in-out"
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
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 transition duration-200 ease-in-out"
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
                {/* Tailwind CSS CDN and base font style for login/register page */}
                <script src="https://cdn.tailwindcss.com"></script>
                <style
                    dangerouslySetInnerHTML={{
                        __html: `
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                body {
                  font-family: 'Inter', sans-serif;
                  margin: 0;
                }
              `
                    }}
                />
            </div>
        );
    }

    // Render Chat interface if authenticated
    return (
        <div className="flex h-screen bg-gray-50 font-inter text-gray-800">
            {/* Sidebar for Chats/Groups */}
            <div className="w-1/4 bg-white border-r border-gray-200 flex flex-col shadow-lg p-4">
                <h2 className="text-2xl font-bold text-emerald-700 mb-6 border-b pb-4">Chats</h2>

                {/* Public Chat */}
                <button
                    onClick={() => selectChat(null, 'Public Chat')}
                    className={`w-full text-left p-3 rounded-lg flex items-center mb-2 transition duration-200 ease-in-out
              ${!selectedGroupId ? 'bg-emerald-100 text-emerald-800 font-semibold shadow-sm' : 'hover:bg-gray-100'}
            `}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.941 0 01-4.76-1.39A6.456 6.456 0 002 14v1a1 1 0 001 1h.027a.75.75 0 01.693.447A9.917 9.917 0 0010 19c4.97 0 9-3.582 9-8s-4.03-8-9-8-9 3.582-9 8v1a1 1 0 001 1h.027a.75.75 0 01.693.447A9.917 9.917 0 0010 19c4.97 0 9-3.582 9-8s-4.03-8-9-8-9 3.582-9 8z" clipRule="evenodd" />
                    </svg>
                    Public Chat
                </button>

                {/* Group List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    <h3 className="text-lg font-semibold text-gray-700 mt-4 mb-3">Your Groups</h3>
                    {groups.length === 0 ? (
                        <p className="text-sm text-gray-500">No groups yet. Create or join one!</p>
                    ) : (
                        groups.map(group => (
                            <button
                                key={group.id}
                                onClick={() => selectChat(group.id, group.name)}
                                className={`w-full text-left p-3 rounded-lg flex items-center mb-2 transition duration-200 ease-in-out
                    ${selectedGroupId === group.id ? 'bg-emerald-100 text-emerald-800 font-semibold shadow-sm' : 'hover:bg-gray-100'}
                  `}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 002 15v3H0v-3a3 3 0 014.75-2.906z"/>
                                </svg>
                                {group.name}
                            </button>
                        ))
                    )}
                </div>

                {/* Group Actions */}
                <div className="mt-auto pt-4 border-t border-gray-200">
                    <button
                        onClick={() => setShowGroupModal(true)}
                        className="w-full py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition duration-200 ease-in-out shadow-md flex items-center justify-center"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                        </svg>
                        Create / Join Group
                    </button>
                    {/* Logout is already in header, so keep it there */}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col bg-gray-50">
                {/* Chat Header */}
                <header className="bg-white p-4 shadow-md flex items-center justify-between rounded-bl-lg sticky top-0 z-10">
                    <h1 className="text-xl font-bold text-emerald-800">
                        {selectedGroupName}
                    </h1>
                    <div className="flex items-center space-x-3">
                        {currentUserName && (
                            <span className="text-sm bg-emerald-700 text-white px-3 py-1 rounded-full shadow">
                  Logged in as: {currentUserName}
                </span>
                        )}
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-red-500 text-white rounded-full text-sm font-semibold hover:bg-red-600 transition duration-200 ease-in-out shadow-md"
                        >
                            Logout
                        </button>
                    </div>
                </header>

                {/* Messages Display */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-chat-pattern"> {/* Added pattern for background */}
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
                                className={`max-w-[70%] md:max-w-[60%] lg:max-w-[50%] p-3 rounded-xl shadow-sm relative ${ // Adjusted max-width for bubbles
                                    msg.senderId === currentUserId
                                        ? 'bg-emerald-500 text-white rounded-br-none' // User's message: solid emerald, rounded-br-none for "tail"
                                        : 'bg-white text-gray-800 rounded-bl-none border border-gray-100' // Other's message: white, rounded-bl-none for "tail"
                                } transition-all duration-300 ease-out transform hover:scale-[1.01]`}
                            >
                                <div className={`font-semibold text-xs mb-1 ${msg.senderId === currentUserId ? 'text-emerald-100' : 'text-gray-500'}`}>
                                    {msg.senderId === currentUserId ? 'You' : (msg.senderName || `User ${msg.senderId ? msg.senderId.substring(0, 8) + '...' : 'Unknown'}`)}
                                </div>
                                <p className="text-base break-words leading-tight">{msg.text}</p> {/* Increased text size, adjusted line height */}
                                {msg.timestamp && (
                                    <div className="text-right text-xs mt-1 opacity-80" style={{ color: msg.senderId === currentUserId ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.4)' }}>
                                        {new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200 flex items-center rounded-tl-lg shadow-t-lg">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 p-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 transition duration-200 ease-in-out text-base"
                    />
                    <button
                        type="submit"
                        className="ml-3 px-6 py-3 bg-emerald-500 text-white rounded-full font-semibold hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition duration-200 ease-in-out shadow-lg transform active:scale-95"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l4.453-1.48a1 1 0 00.65-.947V9a1 1 0 112 0v7.113a1 1 0 00.65.947l4.453 1.48a1 1 0 001.169-1.409l-7-14z" />
                        </svg>
                    </button>
                </form>
            </div>

            {/* Create/Join Group Modal */}
            {showGroupModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md">
                        <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">Manage Groups</h3>
                        {authError && <p className="text-red-600 text-center mb-4">{authError}</p>}

                        {/* Create Group Form */}
                        <form onSubmit={handleCreateGroup} className="mb-6 border-b pb-6 border-gray-200">
                            <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="newGroupName">
                                Create New Group
                            </label>
                            <input
                                type="text"
                                id="newGroupName"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 transition duration-200 ease-in-out mb-4"
                                placeholder="Enter new group name"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                required
                            />
                            <button
                                type="submit"
                                className="w-full py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition duration-200 ease-in-out shadow-md"
                            >
                                Create Group
                            </button>
                        </form>

                        {/* Join Group Form */}
                        <form onSubmit={handleJoinGroup}>
                            <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="joinGroupId">
                                Join Existing Group (by ID)
                            </label>
                            <input
                                type="text"
                                id="joinGroupId"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 transition duration-200 ease-in-out mb-4"
                                placeholder="Enter group ID"
                                value={joinGroupId}
                                onChange={(e) => setJoinGroupId(e.target.value)}
                                required
                            />
                            <button
                                type="submit"
                                className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition duration-200 ease-in-out shadow-md"
                            >
                                Join Group
                            </button>
                        </form>

                        <button
                            onClick={() => { setShowGroupModal(false); setAuthError(''); }}
                            className="mt-6 w-full py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition duration-200 ease-in-out"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Tailwind CSS CDN and custom styles */}
            <script src="https://cdn.tailwindcss.com"></script>
            <style
                dangerouslySetInnerHTML={{
                    __html: `
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
              body {
                font-family: 'Inter', sans-serif;
                margin: 0;
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
              /* Background pattern inspired by WhatsApp */
              .bg-chat-pattern {
                background-image: url('data:image/svg+xml,%3Csvg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath fill="%23e0e0e0" fill-opacity="0.35" d="M16 0H0V16h16V0zM1 1h14v14H1V1z"/%3E%3C/svg%3E');
                background-size: 8px 8px;
              }
            `
                }}
            />
        </div>
    );
}

export default App;
