import React, { useState, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import {
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    doc,
    getDoc,
    updateDoc,
    arrayUnion,
    arrayRemove, // Make sure arrayRemove is imported
    deleteDoc
} from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

import {
    Hash, // For channels
    MessageSquare, // For direct messages
    PlusCircle,
    LogOut,
    Send,
    UploadCloud, // For file upload
    FileText, // For general file type
    Image, // For image files
    Download, // For download link
    Users, // For channel members
    Trash2, // For deleting messages (admin/self)
    ClipboardCopy, // For copying channel ID
    XCircle, // For closing modals/errors
    Key // For channel ID
} from 'lucide-react'; // Using lucide-react for modern icons

// Helper for displaying file sizes nicely
const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Sub-components (defined within SlackApp.js for single file clarity and debugging context)

const Sidebar = ({ channels, selectedChannelId, selectChat, setShowChannelModal, handleLogout, currentUserName, currentUserId, db, setAuthError, authError }) => {
    const [showProfileModal, setShowProfileModal] = useState(false);

    const handleLeaveChannel = async (channelId) => {
        if (!window.confirm("Are you sure you want to leave this channel?")) return;

        try {
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
            const channelRef = doc(db, `artifacts/${appId}/public/data/channels`, channelId);
            await updateDoc(channelRef, {
                members: arrayRemove(currentUserId)
            });
            // Optionally remove from local state immediately to update UI faster
            // setChannels(prevChannels => prevChannels.filter(c => c.id !== channelId));
            alert('Left channel successfully!');
            selectChat(null, 'Welcome'); // Redirect to general chat
        } catch (error) {
            console.error("Error leaving channel:", error);
            setAuthError(`Failed to leave channel: ${error.message}`);
        }
    };

    return (
        <div className="w-64 bg-gray-900 text-gray-100 flex flex-col shadow-xl z-20">
            {/* Top Section: Workspace Name and User */}
            <div className="p-4 border-b border-gray-700 flex flex-col items-start">
                <h1 className="text-xl font-extrabold text-emerald-400 mb-2">Slack Clone</h1>
                <button
                    onClick={() => setShowProfileModal(true)}
                    className="flex items-center text-gray-200 hover:bg-gray-700 px-3 py-1 rounded-lg w-full text-left transition duration-200"
                >
                    <User className="h-5 w-5 mr-2 text-emerald-300" />
                    <span className="font-semibold text-lg">{currentUserName}</span>
                </button>
            </div>

            {/* Channels List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-md font-semibold text-gray-400 uppercase tracking-wider">Channels</h3>
                    <button
                        onClick={() => setShowChannelModal(true)}
                        className="text-gray-400 hover:text-emerald-400 transition duration-200"
                        title="Create or Join Channel"
                    >
                        <PlusCircle className="h-5 w-5" />
                    </button>
                </div>

                {channels.length === 0 ? (
                    <p className="text-sm text-gray-500">No channels yet. Create or join one!</p>
                ) : (
                    channels.map(channel => (
                        <div key={channel.id} className="relative flex items-center group">
                            <button
                                onClick={() => selectChat(channel.id, channel.name)}
                                className={`w-full text-left px-3 py-2 rounded-lg flex items-center mb-1 transition duration-200 ease-in-out
                  ${selectedChannelId === channel.id ? 'bg-emerald-700 text-white font-semibold' : 'hover:bg-gray-700'}
                `}
                            >
                                <Hash className="h-4 w-4 mr-2 text-gray-400" />
                                {channel.name}
                            </button>
                            {/* Leave channel button - only appears on hover for joined channels, not the Welcome/Public chat */}
                            {channel.id !== null && // Exclude public/welcome chat
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleLeaveChannel(channel.id); }}
                                    className="absolute right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out"
                                    title="Leave Channel"
                                >
                                    <LogOut className="h-3 w-3" />
                                </button>
                            }
                        </div>
                    ))
                )}
            </div>

            {/* Direct Messages (Future expansion) */}
            <div className="p-4 border-t border-gray-700">
                <h3 className="text-md font-semibold text-gray-400 uppercase tracking-wider">Direct Messages</h3>
                <p className="text-sm text-gray-500">Coming soon!</p>
            </div>

            {/* Footer: Logout */}
            <div className="p-4 border-t border-gray-700">
                <button
                    onClick={handleLogout}
                    className="w-full py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition duration-200 ease-in-out shadow-md flex items-center justify-center"
                >
                    <LogOut className="h-5 w-5 mr-2" />
                    Logout
                </button>
            </div>
            {showProfileModal && (
                <ProfileModal
                    setShowProfileModal={setShowProfileModal}
                    currentUserName={currentUserName}
                    currentUserId={currentUserId}
                    db={db}
                    setAuthError={setAuthError}
                    authError={authError} // Pass authError to ProfileModal
                />
            )}
        </div>
    );
};


const ChannelHeader = ({ selectedChannelName, channelMembersCount }) => (
    <header className="bg-white p-4 border-b border-gray-200 shadow-sm flex items-center justify-between z-10">
        <h1 className="text-xl font-bold text-gray-900 flex items-center">
            <Hash className="h-5 w-5 mr-2 text-gray-500" />
            {selectedChannelName}
        </h1>
        {channelMembersCount !== null && (
            <span className="text-sm text-gray-600 flex items-center">
        <Users className="h-4 w-4 mr-1 text-gray-400" /> {channelMembersCount} Members
      </span>
        )}
    </header>
);

const MessageList = ({ messages, currentUserId, messagesEndRef, db, currentUserName, selectedChannelId, setAuthError }) => {
    const handleDeleteMessage = async (messageId, fileUrl) => {
        if (!window.confirm("Are you sure you want to delete this message?")) return;
        try {
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
            const messageRef = selectedChannelId
                ? doc(db, `artifacts/${appId}/public/data/channels/${selectedChannelId}/messages`, messageId)
                : doc(db, `artifacts/${appId}/public/data/messages`, messageId);

            await deleteDoc(messageRef);

            // If there's a file, delete it from storage
            if (fileUrl) {
                const storage = getStorage();
                const fileRef = ref(storage, fileUrl);
                await deleteObject(fileRef);
            }
        } catch (error) {
            console.error("Error deleting message:", error);
            setAuthError(`Failed to delete message: ${error.message}`);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-chat-pattern">
            {messages.length === 0 ? (
                <div className="text-center text-gray-500 mt-10">
                    No messages here. Be the first to say something!
                </div>
            ) : (
                messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${
                            msg.senderId === currentUserId ? 'justify-end' : 'justify-start'
                        }`}
                    >
                        <div
                            className={`max-w-[75%] lg:max-w-[60%] p-3 rounded-xl shadow-md relative group ${
                                msg.senderId === currentUserId
                                    ? 'bg-emerald-600 text-white rounded-br-sm' // User's message
                                    : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100' // Other's message
                            } transition-all duration-200 ease-in-out transform hover:scale-[1.01]`}
                        >
                            <div className={`font-semibold text-sm mb-1 ${msg.senderId === currentUserId ? 'text-emerald-100' : 'text-gray-600'}`}>
                                {msg.senderId === currentUserId ? 'You' : (msg.senderName || `User ${msg.senderId ? msg.senderId.substring(0, 8) + '...' : 'Unknown'}`)}
                            </div>
                            {msg.type === 'text' && (
                                <p className="text-base break-words leading-tight whitespace-pre-wrap">{msg.text}</p>
                            )}
                            {msg.type === 'file' && msg.fileUrl && (
                                <div className="flex flex-col items-start space-y-2">
                                    {msg.fileType && msg.fileType.startsWith('image/') ? (
                                        // Display image with max dimensions
                                        <img
                                            src={msg.fileUrl}
                                            alt={msg.fileName || 'Uploaded image'}
                                            className="max-w-full max-h-64 object-contain rounded-lg shadow"
                                            onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/150x100/A0AEC0/FFFFFF?text=Image+Error"; }} // Fallback image on error
                                        />
                                    ) : (
                                        <div className="flex items-center space-x-2"> {/* Removed text-blue-600 hover:underline cursor-pointer here to apply class from anchor tag*/}
                                            <FileText className={`h-5 w-5 ${msg.senderId === currentUserId ? 'text-emerald-100' : 'text-gray-500'}`} />
                                            <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className={msg.senderId === currentUserId ? "text-emerald-100" : "text-blue-600"}>
                                                {msg.fileName || 'Download File'}
                                            </a>
                                        </div>
                                    )}
                                    {msg.fileSize && (
                                        <span className="text-xs opacity-80" style={{ color: msg.senderId === currentUserId ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.4)' }}>
                      ({formatBytes(msg.fileSize)})
                    </span>
                                    )}
                                </div>
                            )}
                            {msg.timestamp && (
                                <div className="text-right text-xs mt-1 opacity-80" style={{ color: msg.senderId === currentUserId ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.4)' }}>
                                    {new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            )}
                            {/* Delete button (visible on hover if current user sent message) */}
                            {msg.senderId === currentUserId && (
                                <button
                                    onClick={() => handleDeleteMessage(msg.id, msg.fileUrl)}
                                    className="absolute -top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out"
                                    title="Delete message"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    </div>
                ))
            )}
            <div ref={messagesEndRef} />
        </div>
    );
};

const MessageInput = ({ newMessage, setNewMessage, handleSendMessage, handleFileUpload, uploadProgress }) => {
    const fileInputRef = useRef(null);

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    return (
        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200 flex items-center shadow-lg relative">
            <button
                type="button"
                onClick={triggerFileInput}
                className="p-2 mr-2 bg-gray-200 text-gray-600 rounded-full hover:bg-gray-300 transition duration-200 ease-in-out flex items-center justify-center shadow-sm"
                title="Attach File"
            >
                <UploadCloud className="h-5 w-5" />
            </button>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden" // Hide the actual file input
            />

            <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Message #channel-name"
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition duration-200 ease-in-out text-base"
            />
            <button
                type="submit"
                className="ml-3 px-5 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition duration-200 ease-in-out shadow-md transform active:scale-95"
            >
                <Send className="h-5 w-5" />
            </button>

            {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="absolute top-0 left-0 right-0 h-2 rounded-t-lg overflow-hidden">
                    <div
                        className="bg-emerald-500 h-full transition-all duration-100 ease-linear"
                        style={{ width: `${uploadProgress}%` }}
                    ></div>
                </div>
            )}
        </form>
    );
};


const ChannelModal = ({
                          showModal,
                          setShowModal,
                          authError,
                          setAuthError,
                          handleCreateChannel,
                          newChannelName,
                          setNewChannelName,
                          handleJoinChannel,
                          joinChannelId,
                          setJoinChannelId // Added setJoinChannelId
                      }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md text-white border border-gray-700 relative">
                <button
                    onClick={() => { setShowModal(false); setAuthError(''); }}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition duration-200"
                    title="Close"
                >
                    <XCircle className="h-6 w-6" />
                </button>
                <h3 className="text-2xl font-bold text-center text-emerald-400 mb-6">Manage Channels</h3>
                {authError && <p className="text-red-500 text-center mb-4 text-sm">{authError}</p>}

                {/* Create Channel Form */}
                <form onSubmit={handleCreateChannel} className="mb-8 border-b border-gray-700 pb-6">
                    <label className="block text-gray-300 text-sm font-semibold mb-2" htmlFor="newChannelName">
                        Create New Channel
                    </label>
                    <input
                        type="text"
                        id="newChannelName"
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition duration-200 ease-in-out mb-4"
                        placeholder="Enter new channel name (e.g., general, random)"
                        value={newChannelName}
                        onChange={(e) => setNewChannelName(e.target.value)}
                        required
                    />
                    <button
                        type="submit"
                        className="w-full py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition duration-200 ease-in-out shadow-md transform active:scale-95"
                    >
                        Create Channel
                    </button>
                </form>

                {/* Join Channel Form */}
                <form onSubmit={(e) => handleJoinChannel(e, joinChannelId)}>
                    <label className="block text-gray-300 text-sm font-semibold mb-2" htmlFor="joinChannelId">
                        Join Existing Channel (by ID)
                    </label>
                    <div className="flex items-center relative mb-4">
                        <input
                            type="text"
                            id="joinChannelId"
                            className="flex-1 p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition duration-200 ease-in-out pr-10"
                            placeholder="Enter channel ID"
                            value={joinChannelId}
                            onChange={(e) => setJoinChannelId(e.target.value)} // Correctly update joinChannelId state
                            required
                        />
                        {joinChannelId && ( // Show copy button only if there's an ID
                            <button
                                type="button"
                                onClick={() => {
                                    // Copy ID to clipboard
                                    navigator.clipboard.writeText(joinChannelId)
                                        .then(() => alert('Channel ID copied to clipboard!'))
                                        .catch(err => {
                                            // Fallback for document.execCommand if clipboard.writeText fails (e.g., older browsers, insecure contexts)
                                            const textarea = document.createElement('textarea');
                                            textarea.value = joinChannelId;
                                            document.body.appendChild(textarea);
                                            textarea.select();
                                            document.execCommand('copy');
                                            document.body.removeChild(textarea);
                                            alert('Channel ID copied to clipboard!');
                                        });
                                }}
                                className="absolute right-2 text-gray-400 hover:text-emerald-400"
                                title="Copy Channel ID"
                            >
                                <ClipboardCopy className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                    <button
                        type="submit"
                        className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition duration-200 ease-in-out shadow-md transform active:scale-95"
                    >
                        <Key className="inline-block h-5 w-5 mr-2" /> Join Channel
                    </button>
                </form>
            </div>
        </div>
    );
};

const ProfileModal = ({ showProfileModal, setShowProfileModal, currentUserName, currentUserId, db, setAuthError }) => {
    const [isAdminOf, setIsAdminOf] = useState([]);
    const [selectedChannelForAdmin, setSelectedChannelForAdmin] = useState('');
    const [newAdminUserId, setNewAdminUserId] = useState('');
    // const [allChannels, setAllChannels] = useState([]); // Not directly used in UI for selection here

    useEffect(() => {
        if (!db || !currentUserId || !showProfileModal) return; // Only run if modal is open and Firebase is ready

        const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
        const channelsCollectionRef = collection(db, `artifacts/${appId}/public/data/channels`);

        // Listen to all channels to dynamically determine admin status
        const unsubscribe = onSnapshot(channelsCollectionRef, (snapshot) => {
            const adminChannels = [];
            snapshot.docs.forEach(docSnap => {
                const data = { id: docSnap.id, ...docSnap.data() };
                if (data.admin && data.admin.includes(currentUserId)) {
                    adminChannels.push(data);
                }
            });
            setIsAdminOf(adminChannels);
        }, (error) => {
            console.error("Error fetching admin channels:", error);
            setAuthError("Failed to fetch admin channels."); // Use local error for modal
        });

        return () => unsubscribe(); // Cleanup listener
    }, [db, currentUserId, showProfileModal, setAuthError]);


    const handleAddAdmin = async (e) => {
        e.preventDefault();
        setAuthError(''); // Clear previous errors
        if (!selectedChannelForAdmin || !newAdminUserId.trim() || !db) {
            setAuthError("Please select a channel and enter a user ID.");
            return;
        }

        try {
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
            const channelRef = doc(db, `artifacts/${appId}/public/data/channels`, selectedChannelForAdmin);
            const channelSnap = await getDoc(channelRef); // Get the channel document

            if (!channelSnap.exists()) {
                setAuthError("Selected channel does not exist.");
                return;
            }

            const channelData = channelSnap.data();
            // Check if current user is an admin of this channel
            if (!channelData.admin || !channelData.admin.includes(currentUserId)) {
                setAuthError("You are not an admin of this channel and cannot add new admins.");
                return;
            }
            // Check if the user to be added is a member of this channel
            if (!channelData.members || !channelData.members.includes(newAdminUserId)) {
                setAuthError("The user ID provided is not a member of this channel.");
                return;
            }
            // Check if the user is already an admin
            if (channelData.admin && channelData.admin.includes(newAdminUserId)) {
                setAuthError("This user is already an admin of this channel.");
                return;
            }


            // Add the new user ID to the 'admin' array using arrayUnion
            await updateDoc(channelRef, {
                admin: arrayUnion(newAdminUserId)
            });
            setNewAdminUserId(''); // Clear input
            setAuthError("Admin added successfully!"); // Success message
        } catch (error) {
            console.error("Error adding admin:", error);
            setAuthError(`Failed to add admin: ${error.message}`);
        }
    };

    // If modal is not meant to be shown, return null
    if (!showProfileModal) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-xl text-white border border-gray-700 relative">
                {/* Close Button */}
                <button
                    onClick={() => setShowProfileModal(false)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition duration-200"
                    title="Close"
                >
                    <XCircle className="h-6 w-6" />
                </button>
                <h3 className="text-2xl font-bold text-center text-emerald-400 mb-6">Your Profile</h3>
                {/* Display Local Errors */}
                {/* Note: ProfileModal now receives authError directly, so it can display it. */}
                {setAuthError && ( // Check if setAuthError prop exists before trying to display it
                    <p className="text-red-500 text-center mb-4 text-sm flex items-center justify-center">
                        <XCircle className="h-4 w-4 mr-2" /> {setAuthError}
                    </p>
                )}

                {/* User Information */}
                <div className="mb-6 border-b border-gray-700 pb-6">
                    <p className="text-lg font-semibold mb-2">Username: <span className="font-normal text-gray-300">{currentUserName}</span></p>
                    <p className="text-lg font-semibold">Your User ID: <span className="font-normal text-gray-300 break-all">{currentUserId}</span></p>
                </div>

                {/* Admin Management Section (only if user is an admin of any channel) */}
                {isAdminOf.length > 0 && (
                    <div className="mb-6 border-b border-gray-700 pb-6">
                        <h4 className="text-xl font-bold text-emerald-300 mb-4">Channels You Administer:</h4>
                        <ul className="list-disc list-inside space-y-2">
                            {isAdminOf.map(channel => (
                                <li key={channel.id} className="flex items-center text-gray-300">
                                    <Hash className="h-4 w-4 mr-2 text-gray-500" />
                                    {channel.name} (<span className="text-xs text-gray-500 break-all">{channel.id}</span>)
                                </li>
                            ))}
                        </ul>

                        <form onSubmit={handleAddAdmin} className="mt-6 space-y-4">
                            <h4 className="text-xl font-bold text-emerald-300 mb-3">Add Admin to a Channel:</h4>
                            <div>
                                <label className="block text-gray-300 text-sm font-semibold mb-2" htmlFor="selectAdminChannel">
                                    Select Channel (where you are an admin)
                                </label>
                                <select
                                    id="selectAdminChannel"
                                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition duration-200 ease-in-out"
                                    value={selectedChannelForAdmin}
                                    onChange={(e) => setSelectedChannelForAdmin(e.target.value)}
                                    required
                                >
                                    <option value="">-- Select a Channel --</option>
                                    {isAdminOf.map(channel => (
                                        <option key={channel.id} value={channel.id}>{channel.name} ({channel.id.substring(0, 8)}...)</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-gray-300 text-sm font-semibold mb-2" htmlFor="newAdminUserId">
                                    User ID to make Admin
                                </label>
                                <input
                                    type="text"
                                    id="newAdminUserId"
                                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition duration-200 ease-in-out"
                                    placeholder="Paste target user's ID here"
                                    value={newAdminUserId}
                                    onChange={(e) => setNewAdminUserId(e.target.value)}
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition duration-200 ease-in-out shadow-md transform active:scale-95 flex items-center justify-center"
                            >
                                <PlusCircle className="h-5 w-5 mr-2" /> Add as Admin
                            </button>
                        </form>
                    </div>
                )}

                {/* Close Profile Button */}
                <button
                    onClick={() => setShowProfileModal(false)}
                    className="mt-6 w-full py-2 bg-gray-700 text-gray-200 rounded-lg font-semibold hover:bg-gray-600 transition duration-200 ease-in-out"
                >
                    Close Profile
                </button>
            </div>
        </div>
    );
};

function SlackApp({ db, auth, currentUserId, currentUserName, setAuthError }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [channels, setChannels] = useState([]);
    const [selectedChannelId, setSelectedChannelId] = useState(null);
    const [selectedChannelName, setSelectedChannelName] = useState('Welcome'); // Default to a general "Welcome"
    const [channelMembersCount, setChannelMembersCount] = useState(null); // Track members for current channel
    const [newChannelName, setNewChannelName] = useState('');
    const [joinChannelId, setJoinChannelId] = useState('');
    const [showChannelModal, setShowChannelModal] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0); // For file upload
    const messagesEndRef = useRef(null);

    // Fetch channels and messages based on selectedChannel
    useEffect(() => {
        if (!db || !currentUserId) {
            setMessages([]);
            setChannels([]);
            setChannelMembersCount(null);
            return;
        }

        const appId = process.env.REACT_APP_APP_ID || 'default-app-id';

        // 1. Fetch channels the current user is a member of
        const channelsCollectionRef = collection(db, `artifacts/${appId}/public/data/channels`);
        const qChannels = query(channelsCollectionRef);
        const unsubscribeChannels = onSnapshot(qChannels, (snapshot) => {
            const fetchedChannels = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).filter(channel => channel.members && channel.members.includes(currentUserId));
            setChannels(fetchedChannels);

            // If no channel is selected or the selected channel is no longer valid (e.g., user left it),
            // default to the first available channel or 'Welcome'
            if (!selectedChannelId || !fetchedChannels.some(c => c.id === selectedChannelId)) {
                if (fetchedChannels.length > 0) {
                    setSelectedChannelId(fetchedChannels[0].id);
                    setSelectedChannelName(fetchedChannels[0].name);
                    setChannelMembersCount(fetchedChannels[0].members ? fetchedChannels[0].members.length : 0);
                } else {
                    // No channels available, default to 'Welcome' view
                    setSelectedChannelId(null);
                    setSelectedChannelName('Welcome');
                    setChannelMembersCount(null);
                }
            } else {
                // If selected channel is still valid, ensure its name and member count are up-to-date
                const currentChannelData = fetchedChannels.find(c => c.id === selectedChannelId);
                if (currentChannelData) {
                    setSelectedChannelName(currentChannelData.name);
                    setChannelMembersCount(currentChannelData.members ? currentChannelData.members.length : 0);
                } else {
                    // Fallback if selected channel somehow becomes invalid (e.g., deleted by admin)
                    setSelectedChannelId(null);
                    setSelectedChannelName('Welcome');
                    setChannelMembersCount(null);
                }
            }
        }, (error) => {
            console.error("Error fetching channels:", error);
            setAuthError("Failed to load channels.");
        });


        // 2. Fetch messages for the currently selected chat (public or channel)
        let messagesCollectionPath;
        if (selectedChannelId) {
            messagesCollectionPath = `artifacts/${appId}/public/data/channels/${selectedChannelId}/messages`;
        } else {
            messagesCollectionPath = `artifacts/${appId}/public/data/messages`; // Public chat/default if no channels
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
            setAuthError("Failed to load messages.");
        });

        // Cleanup function for useEffect
        return () => {
            unsubscribeChannels();
            unsubscribeMessages();
        };
    }, [db, currentUserId, selectedChannelId, setAuthError]); // Dependencies: re-run when these change

    // Effect to scroll to the latest message whenever messages array updates
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Handle user logout
    const handleLogout = async () => {
        setAuthError(''); // Clear any auth errors
        if (!auth) return; // Ensure auth object is available
        try {
            await signOut(auth);
            // The onAuthStateChanged listener in App.js will detect this and
            // set currentUser to null, triggering a re-render to AuthScreen.
        } catch (error) {
            console.error("Error logging out:", error);
            setAuthError(`Logout failed: ${error.message}`);
        }
    };

    // Handle sending a new text message
    const handleSendMessage = async (e) => {
        e.preventDefault(); // Prevent default form submission
        if (newMessage.trim() === '' || !db || !currentUserId) {
            return; // Don't send empty messages or if essential data is missing
        }

        try {
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
            let messagesCollectionRef;

            if (selectedChannelId) {
                messagesCollectionRef = collection(db, `artifacts/${appId}/public/data/channels/${selectedChannelId}/messages`);
            } else {
                messagesCollectionRef = collection(db, `artifacts/${appId}/public/data/messages`); // Public chat
            }

            await addDoc(messagesCollectionRef, {
                text: newMessage,
                senderId: currentUserId,
                senderName: currentUserName,
                timestamp: serverTimestamp(), // Firestore server timestamp
                type: 'text' // Message type for future expansion (e.g., 'file')
            });
            setNewMessage(''); // Clear input field after sending
        } catch (error) {
            console.error("Error sending message:", error);
            setAuthError(`Failed to send message: ${error.message}`);
        }
    };

    // Handle file uploads
    const handleFileUpload = (e) => {
        const file = e.target.files[0]; // Get the selected file
        if (!file) return; // If no file selected, do nothing

        setUploadProgress(0); // Reset upload progress to 0

        const storage = getStorage(); // Get Firebase Storage instance
        const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
        // Create a unique storage path for the file: uploads/{appId}/{channelIdOrPublic}/{userId}/{timestamp_filename}
        const storageRef = ref(storage, `uploads/${appId}/${selectedChannelId || 'public'}/${currentUserId}/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file); // Start the upload task

        // Monitor upload progress and state changes
        uploadTask.on('state_changed',
            (snapshot) => {
                // Calculate and update upload progress
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            },
            (error) => {
                // Handle unsuccessful uploads
                console.error("Upload failed:", error);
                setAuthError(`File upload failed: ${error.message}`);
                setUploadProgress(0); // Reset progress on error
            },
            () => {
                // Handle successful uploads on complete
                getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
                    try {
                        // Determine the correct Firestore messages collection
                        const messagesCollectionRef = selectedChannelId
                            ? collection(db, `artifacts/${appId}/public/data/channels/${selectedChannelId}/messages`)
                            : collection(db, `artifacts/${appId}/public/data/messages`);

                        await addDoc(messagesCollectionRef, {
                            fileUrl: downloadURL, // URL to the uploaded file
                            fileName: file.name,
                            fileType: file.type,
                            fileSize: file.size,
                            senderId: currentUserId,
                            senderName: currentUserName,
                            timestamp: serverTimestamp(),
                            type: 'file' // Mark message as type 'file'
                        });
                        setUploadProgress(0); // Reset progress after successful message creation
                        setNewMessage(''); // Clear any text in the message input
                    } catch (error) {
                        console.error("Error saving file message to Firestore:", error);
                        setAuthError(`Failed to save file message: ${error.message}`);
                        setUploadProgress(0); // Reset progress on Firestore error
                    }
                });
            }
        );
    };

    const handleCreateChannel = async (e) => {
        e.preventDefault();
        setAuthError(''); // Clear previous errors
        if (newChannelName.trim() === '' || !db || !currentUserId) {
            setAuthError('Channel name cannot be empty.');
            return;
        }

        try {
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
            const channelsCollectionRef = collection(db, `artifacts/${appId}/public/data/channels`);
            const newChannelRef = await addDoc(channelsCollectionRef, {
                name: newChannelName,
                createdAt: serverTimestamp(),
                createdBy: currentUserId,
                admin: [currentUserId], // Creator is the initial admin
                members: [currentUserId] // Creator is the initial member
            });
            setSelectedChannelId(newChannelRef.id); // Select the newly created channel
            setSelectedChannelName(newChannelName);
            setNewChannelName(''); // Clear input
            setShowChannelModal(false); // Close modal
        } catch (error) {
            console.error("Error creating channel:", error);
            setAuthError(`Failed to create channel: ${error.message}`);
        }
    };

    const handleJoinChannel = async (e, channelIdToJoin) => {
        e.preventDefault();
        setAuthError(''); // Clear previous errors
        if (channelIdToJoin.trim() === '' || !db || !currentUserId) {
            setAuthError('Channel ID cannot be empty.');
            return;
        }

        try {
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
            const channelDocRef = doc(db, `artifacts/${appId}/public/data/channels`, channelIdToJoin);
            const channelDocSnap = await getDoc(channelDocRef); // Get channel document

            if (channelDocSnap.exists()) {
                const channelData = channelDocSnap.data();
                if (channelData.members && channelData.members.includes(currentUserId)) {
                    setAuthError('You are already a member of this channel.');
                    return;
                }

                // Add current user to the channel's members array
                await updateDoc(channelDocRef, {
                    members: arrayUnion(currentUserId)
                });
                setSelectedChannelId(channelIdToJoin); // Select the joined channel
                setSelectedChannelName(channelData.name);
                setJoinChannelId(''); // Clear input
                setShowChannelModal(false); // Close modal
            } else {
                setAuthError('Channel not found with this ID.');
            }
        } catch (error) {
            console.error("Error joining channel:", error);
            setAuthError(`Failed to join channel: ${error.message}`);
        }
    };

    // Function to switch the active chat (channel or public)
    const selectChat = (channelId, channelName) => {
        setSelectedChannelId(channelId);
        setSelectedChannelName(channelName);
        // Update member count based on the selected channel's data
        if (channelId) {
            const selectedChannel = channels.find(c => c.id === channelId);
            setChannelMembersCount(selectedChannel ? selectedChannel.members.length : 0);
        } else {
            setChannelMembersCount(null); // Public chat doesn't have a specific member count displayed
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 text-gray-800 antialiased">
            {/* Sidebar Component */}
            <Sidebar
                channels={channels}
                selectedChannelId={selectedChannelId}
                selectChat={selectChat}
                setShowChannelModal={setShowChannelModal}
                handleLogout={handleLogout}
                currentUserName={currentUserName}
                currentUserId={currentUserId}
                db={db}
                setAuthError={setAuthError}
                authError={authError} // Pass authError to Sidebar as well
            />

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-800 rounded-l-lg shadow-inner">
                {/* Channel Header Component */}
                <ChannelHeader
                    selectedChannelName={selectedChannelName}
                    channelMembersCount={selectedChannelId ? channelMembersCount : null}
                />

                {/* Message List Component */}
                <MessageList
                    messages={messages}
                    currentUserId={currentUserId}
                    messagesEndRef={messagesEndRef}
                    db={db}
                    currentUserName={currentUserName}
                    selectedChannelId={selectedChannelId}
                    setAuthError={setAuthError}
                />

                {/* Message Input Component */}
                <MessageInput
                    newMessage={newMessage}
                    setNewMessage={setNewMessage}
                    handleSendMessage={handleSendMessage}
                    handleFileUpload={handleFileUpload}
                    uploadProgress={uploadProgress}
                />
            </div>

            {/* Channel Modal Component (for creating/joining channels) */}
            {showChannelModal && (
                <ChannelModal
                    showModal={showChannelModal}
                    setShowModal={setShowChannelModal}
                    authError={authError}
                    setAuthError={setAuthError}
                    handleCreateChannel={handleCreateChannel}
                    newChannelName={newChannelName}
                    setNewChannelName={setNewChannelName}
                    handleJoinChannel={handleJoinChannel}
                    joinChannelId={joinChannelId}
                    setJoinChannelId={setJoinChannelId}
                />
            )}
        </div>
    );
}

export default SlackApp;
