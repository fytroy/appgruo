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
    arrayRemove,
    deleteDoc
} from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

// IMPORTANT: These imports MUST correctly point to your sub-components.
// They assume these files are directly inside the 'src/components/' folder.
import Sidebar from './Sidebar';
import ChannelHeader from './ChannelHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ChannelModal from './ChannelModal';
import ProfileModal from './ProfileModal';

function SlackApp({ db, auth, currentUserId, currentUserName, setAuthError }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [channels, setChannels] = useState([]); // List of channels user is a member of
    const [selectedChannelId, setSelectedChannelId] = useState(null); // Currently active channel ID (null for 'Welcome')
    const [selectedChannelName, setSelectedChannelName] = useState('Welcome'); // Display name of active channel
    const [channelMembersCount, setChannelMembersCount] = useState(null); // Member count for active channel
    const [newChannelName, setNewChannelName] = useState(''); // State for new channel name input
    const [joinChannelId, setJoinChannelId] = useState(''); // State for joining channel by ID input
    const [showChannelModal, setShowChannelModal] = useState(false); // Visibility of channel management modal
    const [uploadProgress, setUploadProgress] = useState(0); // File upload progress
    const messagesEndRef = useRef(null); // Ref for auto-scrolling to latest message

    // Effect to fetch channels and messages based on selectedChannel
    useEffect(() => {
        if (!db || !currentUserId) {
            setMessages([]);
            setChannels([]);
            setChannelMembersCount(null);
            return;
        }

        const appId = process.env.REACT_APP_APP_ID || 'default-app-id';

        // 1. Setup real-time listener for channels the current user is a member of
        const channelsCollectionRef = collection(db, `artifacts/${appId}/public/data/channels`);
        const qChannels = query(channelsCollectionRef);
        const unsubscribeChannels = onSnapshot(qChannels, (snapshot) => {
            const fetchedChannels = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).filter(channel => channel.members && channel.members.includes(currentUserId)); // Filter by user's membership
            setChannels(fetchedChannels);

            // Logic to manage the currently selected channel:
            // If no channel is selected OR the previously selected channel is no longer valid (e.g., user left it, or it was deleted)
            if (!selectedChannelId || !fetchedChannels.some(c => c.id === selectedChannelId)) {
                if (fetchedChannels.length > 0) {
                    // If there are other channels, auto-select the first one
                    setSelectedChannelId(fetchedChannels[0].id);
                    setSelectedChannelName(fetchedChannels[0].name);
                    setChannelMembersCount(fetchedChannels[0].members ? fetchedChannels[0].members.length : 0);
                } else {
                    // If no channels available, revert to the 'Welcome' default view
                    setSelectedChannelId(null);
                    setSelectedChannelName('Welcome');
                    setChannelMembersCount(null);
                }
            } else {
                // If selected channel is still valid, ensure its displayed name and member count are up-to-date
                const currentChannelData = fetchedChannels.find(c => c.id === selectedChannelId);
                if (currentChannelData) {
                    setSelectedChannelName(currentChannelData.name); // Update name in case it changed
                    setChannelMembersCount(currentChannelData.members ? currentChannelData.members.length : 0);
                } else {
                    // Fallback if selected channel somehow becomes invalid (should be caught by the above 'if' but as a safeguard)
                    setSelectedChannelId(null);
                    setSelectedChannelName('Welcome');
                    setChannelMembersCount(null);
                }
            }
        }, (error) => {
            console.error("Error fetching channels:", error);
            setAuthError("Failed to load channels.");
        });


        // 2. Setup real-time listener for messages in the currently selected chat (public or a specific channel)
        let messagesCollectionPath;
        if (selectedChannelId) {
            // Path for messages within a specific channel
            messagesCollectionPath = `artifacts/${appId}/public/data/channels/${selectedChannelId}/messages`;
        } else {
            // Path for public/default messages if no channel is selected
            messagesCollectionPath = `artifacts/${appId}/public/data/messages`;
        }

        const qMessages = query(collection(db, messagesCollectionPath), orderBy('timestamp')); // Order messages by timestamp

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

        // Cleanup function for useEffect: detaches Firestore listeners when component unmounts or dependencies change
        return () => {
            unsubscribeChannels();
            unsubscribeMessages();
        };
    }, [db, currentUserId, selectedChannelId, setAuthError]); // Dependencies: re-run this effect when these values change

    // Effect to scroll to the latest message whenever the messages array updates
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Handle user logout: calls Firebase Auth signOut
    const handleLogout = async () => {
        setAuthError(''); // Clear any authentication-related errors
        if (!auth) return; // Ensure Firebase Auth object is initialized

        try {
            await signOut(auth);
            // After successful sign out, the onAuthStateChanged listener in App.js will detect this change
            // and set currentUser to null, which will trigger App.js to render the AuthScreen.
        } catch (error) {
            console.error("Error logging out:", error);
            setAuthError(`Logout failed: ${error.message}`); // Display any logout errors
        }
    };

    // Handle sending a new text message to the currently selected channel/public chat
    const handleSendMessage = async (e) => {
        e.preventDefault(); // Prevent default browser form submission
        if (newMessage.trim() === '' || !db || !currentUserId) {
            return; // Do not send empty messages or if essential Firebase/user data is missing
        }

        try {
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
            let messagesCollectionRef;

            // Determine the correct Firestore collection path based on whether a channel is selected
            if (selectedChannelId) {
                messagesCollectionRef = collection(db, `artifacts/${appId}/public/data/channels/${selectedChannelId}/messages`);
            } else {
                messagesCollectionRef = collection(db, `artifacts/${appId}/public/data/messages`); // Path for the public/default chat
            }

            // Add the new message document to Firestore
            await addDoc(messagesCollectionRef, {
                text: newMessage,
                senderId: currentUserId,
                senderName: currentUserName,
                timestamp: serverTimestamp(), // Use Firestore's server timestamp for consistency
                type: 'text' // Explicitly set message type (useful for distinguishing from files)
            });
            setNewMessage(''); // Clear the message input field after sending
        } catch (error) {
            console.error("Error sending message:", error);
            setAuthError(`Failed to send message: ${error.message}`);
        }
    };

    // Handle file uploads to Firebase Storage and then record file message in Firestore
    const handleFileUpload = (e) => {
        const file = e.target.files[0]; // Get the first selected file
        if (!file) return; // If no file was selected, exit

        setUploadProgress(0); // Reset the upload progress bar

        const storage = getStorage(); // Get the Firebase Storage instance
        const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
        // Define the storage path: `uploads/{appId}/{channelId or 'public'}/{userId}/{timestamp_filename}`
        const storageRef = ref(storage, `uploads/${appId}/${selectedChannelId || 'public'}/${currentUserId}/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file); // Initiate the upload task

        // Listen for state changes, errors, and completion of the upload
        uploadTask.on('state_changed',
            (snapshot) => {
                // Calculate the upload progress percentage
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            },
            (error) => {
                // Handle unsuccessful uploads (e.g., permissions, network issues)
                console.error("Upload failed:", error);
                setAuthError(`File upload failed: ${error.message}`);
                setUploadProgress(0); // Reset progress on error
            },
            () => {
                // Handle successful uploads: get download URL and record message in Firestore
                getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
                    try {
                        // Determine the correct Firestore messages collection for the file message
                        const messagesCollectionRef = selectedChannelId
                            ? collection(db, `artifacts/${appId}/public/data/channels/${selectedChannelId}/messages`)
                            : collection(db, `artifacts/${appId}/public/data/messages`);

                        // Add a new message document to Firestore with file details
                        await addDoc(messagesCollectionRef, {
                            fileUrl: downloadURL, // The URL to access the uploaded file
                            fileName: file.name,
                            fileType: file.type,
                            fileSize: file.size,
                            senderId: currentUserId,
                            senderName: currentUserName,
                            timestamp: serverTimestamp(),
                            type: 'file' // Mark this message as a file
                        });
                        setUploadProgress(0); // Reset progress after successfully adding the message
                        setNewMessage(''); // Clear any text in the message input field
                    } catch (error) {
                        console.error("Error saving file message to Firestore:", error);
                        setAuthError(`Failed to save file message: ${error.message}`);
                        setUploadProgress(0); // Reset progress on Firestore error
                    }
                });
            }
        );
    };

    // Handle creating a new channel
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
                admin: [currentUserId], // Creator is automatically an admin
                members: [currentUserId] // Creator is automatically a member
            });
            setSelectedChannelId(newChannelRef.id); // Set the newly created channel as selected
            setSelectedChannelName(newChannelName);
            setNewChannelName(''); // Clear the input field
            setShowChannelModal(false); // Close the channel management modal
        } catch (error) {
            console.error("Error creating channel:", error);
            setAuthError(`Failed to create channel: ${error.message}`);
        }
    };

    // Handle joining an existing channel by its ID
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
            const channelDocSnap = await getDoc(channelDocRef); // Attempt to retrieve the channel document

            if (channelDocSnap.exists()) {
                const channelData = channelDocSnap.data();
                if (channelData.members && channelData.members.includes(currentUserId)) {
                    setAuthError('You are already a member of this channel.');
                    return; // User is already a member, no action needed
                }

                // Add the current user's ID to the channel's 'members' array
                await updateDoc(channelDocRef, {
                    members: arrayUnion(currentUserId)
                });
                setSelectedChannelId(channelIdToJoin); // Set the newly joined channel as selected
                setSelectedChannelName(channelData.name);
                setJoinChannelId(''); // Clear the input field
                setShowChannelModal(false); // Close the modal
            } else {
                setAuthError('Channel not found with this ID.'); // Channel does not exist
            }
        } catch (error) {
            console.error("Error joining channel:", error);
            setAuthError(`Failed to join channel: ${error.message}`);
        }
    };

    // Function to change the currently viewed chat (either a specific channel or the 'Welcome' public chat)
    const selectChat = (channelId, channelName) => {
        setSelectedChannelId(channelId); // Update the selected channel ID
        setSelectedChannelName(channelName); // Update the displayed channel name

        // Update the channel members count for the new selection
        if (channelId) {
            const selectedChannel = channels.find(c => c.id === channelId);
            setChannelMembersCount(selectedChannel ? selectedChannel.members.length : 0);
        } else {
            setChannelMembersCount(null); // The 'Welcome' chat (public) doesn't have a specific member count displayed
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 text-gray-800 antialiased">
            {/* Sidebar Component: Displays channels, user info, and action buttons */}
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
                authError={authError} // Pass authError to Sidebar
            />

            {/* Main Chat Area: Contains header, message list, and input */}
            <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-800 rounded-l-lg shadow-inner">
                {/* Channel Header Component: Displays current channel name and member count */}
                <ChannelHeader
                    selectedChannelName={selectedChannelName}
                    channelMembersCount={selectedChannelId ? channelMembersCount : null}
                />

                {/* Message List Component: Displays all messages for the selected chat */}
                <MessageList
                    messages={messages}
                    currentUserId={currentUserId}
                    messagesEndRef={messagesEndRef}
                    db={db}
                    currentUserName={currentUserName} // Passed for potential future display in message list
                    selectedChannelId={selectedChannelId}
                    setAuthError={setAuthError}
                />

                {/* Message Input Component: Allows typing messages and uploading files */}
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
