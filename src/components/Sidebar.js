import React, { useState } from 'react';
import { LogOut, User, PlusCircle, Hash } from 'lucide-react'; // Lucide icons
import { doc, updateDoc, arrayRemove } from 'firebase/firestore'; // Import Firestore functions

// IMPORTANT: This import assumes ProfileModal.js is in the same 'src/components/' folder.
import ProfileModal from './ProfileModal';

const Sidebar = ({ channels, selectedChannelId, selectChat, setShowChannelModal, handleLogout, currentUserName, currentUserId, db, setAuthError }) => {
    const [showProfileModal, setShowProfileModal] = useState(false); // State to control profile modal visibility

    // Function to handle leaving a channel
    const handleLeaveChannel = async (channelId) => {
        // Confirmation dialog before leaving the channel
        if (!window.confirm("Are you sure you want to leave this channel?")) {
            return;
        }

        try {
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
            const channelRef = doc(db, `artifacts/${appId}/public/data/channels`, channelId);

            // Remove the current user from the members array of the channel
            await updateDoc(channelRef, {
                members: arrayRemove(currentUserId)
            });
            alert('Left channel successfully!');
            // After leaving, redirect to the 'Welcome' or public chat
            selectChat(null, 'Welcome');
        } catch (error) {
            console.error("Error leaving channel:", error);
            setAuthError(`Failed to leave channel: ${error.message}`);
        }
    };

    return (
        <div className="w-64 bg-gray-900 text-gray-100 flex flex-col shadow-xl z-20">
            {/* Top Section: Workspace Name and User Profile Button */}
            <div className="p-4 border-b border-gray-700 flex flex-col items-start">
                <h1 className="text-xl font-extrabold text-emerald-400 mb-2">Slack Clone</h1>
                <button
                    onClick={() => setShowProfileModal(true)} // Opens the ProfileModal
                    className="flex items-center text-gray-200 hover:bg-gray-700 px-3 py-1 rounded-lg w-full text-left transition duration-200"
                >
                    <User className="h-5 w-5 mr-2 text-emerald-300" />
                    <span className="font-semibold text-lg">{currentUserName}</span>
                </button>
            </div>

            {/* Channels List Section */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-md font-semibold text-gray-400 uppercase tracking-wider">Channels</h3>
                    <button
                        onClick={() => setShowChannelModal(true)} // Opens the ChannelModal for create/join actions
                        className="text-gray-400 hover:text-emerald-400 transition duration-200"
                        title="Create or Join Channel"
                    >
                        <PlusCircle className="h-5 w-5" />
                    </button>
                </div>

                {channels.length === 0 ? (
                    <p className="text-sm text-gray-500">No channels yet. Create or join one!</p>
                ) : (
                    // Map through the channels and render a button for each
                    channels.map(channel => (
                        <div key={channel.id} className="relative flex items-center group">
                            <button
                                onClick={() => selectChat(channel.id, channel.name)} // Selects this channel as the active chat
                                className={`w-full text-left px-3 py-2 rounded-lg flex items-center mb-1 transition duration-200 ease-in-out
                  ${selectedChannelId === channel.id ? 'bg-emerald-700 text-white font-semibold' : 'hover:bg-gray-700'}
                `}
                            >
                                <Hash className="h-4 w-4 mr-2 text-gray-400" />
                                {channel.name}
                            </button>
                            {/* Leave channel button:
                  - Only appears if it's an actual channel (not the 'Welcome' public chat which has null ID).
                  - Is absolutely positioned and only visible on hover (opacity-0 group-hover:opacity-100). */}
                            {channel.id !== null && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleLeaveChannel(channel.id); }} // Prevent selecting chat on leave click
                                    className="absolute right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out"
                                    title="Leave Channel"
                                >
                                    <LogOut className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Direct Messages Section - Placeholder for future functionality */}
            <div className="p-4 border-t border-gray-700">
                <h3 className="text-md font-semibold text-gray-400 uppercase tracking-wider mb-3">Direct Messages</h3>
                <p className="text-sm text-gray-500">Coming soon!</p>
            </div>

            {/* Footer: Global Logout Button */}
            <div className="p-4 border-t border-gray-700">
                <button
                    onClick={handleLogout} // Triggers the global logout function passed from SlackApp
                    className="w-full py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition duration-200 ease-in-out shadow-md flex items-center justify-center"
                >
                    <LogOut className="h-5 w-5 mr-2" />
                    Logout
                </button>
            </div>

            {/* Profile Modal: Rendered conditionally */}
            {showProfileModal && (
                <ProfileModal
                    setShowProfileModal={setShowProfileModal}
                    currentUserName={currentUserName}
                    currentUserId={currentUserId}
                    db={db}
                    setAuthError={setAuthError}
                />
            )}
        </div>
    );
};

export default Sidebar;
