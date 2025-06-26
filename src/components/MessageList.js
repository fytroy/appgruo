import React from 'react';
import { FileText, Image, Download, Trash2 } from 'lucide-react'; // Icons for files, images, download, and trash
import { doc, deleteDoc } from 'firebase/firestore'; // Firestore operations for deleting documents
import { getStorage, ref, deleteObject } from 'firebase/storage'; // Firebase Storage operations for deleting files

// Helper function to format file sizes for display (e.g., 1024 bytes -> 1 KB)
const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024; // Kilobyte value
    const dm = decimals < 0 ? 0 : decimals; // Ensure decimals is not negative
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']; // Units for file size

    const i = Math.floor(Math.log(bytes) / Math.log(k)); // Calculate the index of the appropriate unit
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]; // Format and return
};

const MessageList = ({ messages, currentUserId, messagesEndRef, db, selectedChannelId, setAuthError }) => {
    // Function to handle deleting a message and its associated file (if any)
    const handleDeleteMessage = async (messageId, fileUrl) => {
        // Confirmation dialog before proceeding with deletion
        if (!window.confirm("Are you sure you want to delete this message? This action cannot be undone.")) {
            return; // If user cancels, stop the function
        }

        try {
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
            // Determine the correct Firestore document reference for the message
            const messageRef = selectedChannelId
                ? doc(db, `artifacts/${appId}/public/data/channels/${selectedChannelId}/messages`, messageId)
                : doc(db, `artifacts/${appId}/public/data/messages`, messageId);

            // Delete the message document from Firestore
            await deleteDoc(messageRef);

            // If the message contains a fileUrl, attempt to delete the file from Firebase Storage as well
            if (fileUrl) {
                const storage = getStorage(); // Get Firebase Storage instance
                const fileRef = ref(storage, fileUrl); // Create a reference to the file using its URL
                await deleteObject(fileRef); // Delete the file from storage
            }
            // Success message (optional, could use a non-alert UI)
            // alert("Message deleted successfully!");
        } catch (error) {
            console.error("Error deleting message:", error);
            // Set an authentication error message to display in the UI
            setAuthError(`Failed to delete message: ${error.message}`);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-chat-pattern">
            {/* Conditional rendering for when there are no messages */}
            {messages.length === 0 ? (
                <div className="text-center text-gray-500 mt-10">
                    No messages here. Be the first to say something!
                </div>
            ) : (
                // Map through the messages array and render each message
                messages.map((msg) => (
                    <div
                        key={msg.id} // Unique key for React list rendering
                        // Apply flexbox to align messages to the end (right) for current user, start (left) for others
                        className={`flex ${
                            msg.senderId === currentUserId ? 'justify-end' : 'justify-start'
                        }`}
                    >
                        <div
                            className={`max-w-[75%] lg:max-w-[60%] p-3 rounded-xl shadow-md relative group ${ // Responsive width, styling, hover effects
                                msg.senderId === currentUserId
                                    ? 'bg-emerald-600 text-white rounded-br-sm' // Style for current user's messages
                                    : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100' // Style for other users' messages
                            } transition-all duration-200 ease-in-out transform hover:scale-[1.01]`}
                        >
                            {/* Sender's Name */}
                            <div className={`font-semibold text-sm mb-1 ${msg.senderId === currentUserId ? 'text-emerald-100' : 'text-gray-600'}`}>
                                {msg.senderId === currentUserId ? 'You' : (msg.senderName || `User ${msg.senderId ? msg.senderId.substring(0, 8) + '...' : 'Unknown'}`)}
                            </div>

                            {/* Message Content: Text or File */}
                            {msg.type === 'text' && (
                                <p className="text-base break-words leading-tight whitespace-pre-wrap">{msg.text}</p>
                            )}
                            {msg.type === 'file' && msg.fileUrl && (
                                <div className="flex flex-col items-start space-y-2">
                                    {msg.fileType && msg.fileType.startsWith('image/') ? (
                                        // Render image directly if it's an image file, with an error fallback
                                        <img
                                            src={msg.fileUrl}
                                            alt={msg.fileName || 'Uploaded image'}
                                            className="max-w-full max-h-64 object-contain rounded-lg shadow"
                                            onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/150x100/A0AEC0/FFFFFF?text=Image+Error"; }} // Placeholder image on load error
                                        />
                                    ) : (
                                        // Render a general file icon and a downloadable link for non-image files
                                        <div className="flex items-center space-x-2"> {/* Removed text-blue-600 hover:underline cursor-pointer here to apply class from anchor tag*/}
                                            <FileText className={`h-5 w-5 ${msg.senderId === currentUserId ? 'text-emerald-100' : 'text-gray-500'}`} />
                                            <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className={msg.senderId === currentUserId ? "text-emerald-100 hover:underline" : "text-blue-600 hover:underline"}>
                                                {msg.fileName || 'Download File'}
                                            </a>
                                        </div>
                                    )}
                                    {/* Display file size if available */}
                                    {msg.fileSize && (
                                        <span className="text-xs opacity-80" style={{ color: msg.senderId === currentUserId ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.4)' }}>
                      ({formatBytes(msg.fileSize)})
                    </span>
                                    )}
                                </div>
                            )}
                            {/* Message Timestamp */}
                            {msg.timestamp && (
                                <div className="text-right text-xs mt-1 opacity-80" style={{ color: msg.senderId === currentUserId ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.4)' }}>
                                    {new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            )}

                            {/* Delete button: Only visible for messages sent by the current user, on hover */}
                            {msg.senderId === currentUserId && (
                                <button
                                    onClick={() => handleDeleteMessage(msg.id, msg.fileUrl)}
                                    className="absolute -top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out"
                                    title="Delete message"
                                >
                                    <Trash2 className="h-3 w-3" /> {/* Trash icon */}
                                </button>
                            )}
                        </div>
                    </div>
                ))
            )}
            {/* Empty div at the end of the message list for auto-scrolling */}
            <div ref={messagesEndRef} />
        </div>
    );
};

export default MessageList;
