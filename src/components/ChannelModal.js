import React from 'react';
import { PlusCircle, Key, ClipboardCopy, XCircle } from 'lucide-react'; // Icons for plus, key, copy, and close

const ChannelModal = ({
                          showModal,           // Boolean to control modal visibility
                          setShowModal,        // Function to close the modal
                          authError,           // Error message from authentication/Firestore operations
                          setAuthError,        // Function to clear/set authentication errors
                          handleCreateChannel, // Function to handle creating a new channel
                          newChannelName,      // State for the new channel name input
                          setNewChannelName,   // Function to update newChannelName state
                          handleJoinChannel,   // Function to handle joining an existing channel
                          joinChannelId,       // State for the join channel ID input
                          setJoinChannelId     // Function to update joinChannelId state
                      }) => {
    // If showModal is false, don't render anything
    if (!showModal) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md text-white border border-gray-700 relative">
                {/* Close Button for the modal */}
                <button
                    onClick={() => { setShowModal(false); setAuthError(''); }} // Close modal and clear any displayed errors
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition duration-200"
                    title="Close"
                >
                    <XCircle className="h-6 w-6" /> {/* Close icon */}
                </button>
                <h3 className="text-2xl font-bold text-center text-emerald-400 mb-6">Manage Channels</h3>
                {/* Display Authentication/Firestore Errors */}
                {authError && (
                    <p className="text-red-500 text-center mb-4 text-sm flex items-center justify-center">
                        <XCircle className="h-4 w-4 mr-2" /> {authError} {/* Error icon and message */}
                    </p>
                )}

                {/* Form to Create a New Channel */}
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
                        onChange={(e) => setNewChannelName(e.target.value)} // Update state on input change
                        required
                    />
                    <button
                        type="submit"
                        className="w-full py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition duration-200 ease-in-out shadow-md transform active:scale-95"
                    >
                        <PlusCircle className="inline-block h-5 w-5 mr-2" /> Create Channel {/* Plus icon for create */}
                    </button>
                </form>

                {/* Form to Join an Existing Channel by ID */}
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
                            onChange={(e) => setJoinChannelId(e.target.value)} // Update local state for input
                            required
                        />
                        {/* Copy Channel ID Button (only visible if an ID is present in the input) */}
                        {joinChannelId && (
                            <button
                                type="button" // Important: type="button" to prevent form submission
                                onClick={() => {
                                    // Use modern Clipboard API first, with fallback for older browsers
                                    navigator.clipboard.writeText(joinChannelId)
                                        .then(() => alert('Channel ID copied to clipboard!'))
                                        .catch(err => {
                                            // Fallback for document.execCommand
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
                                <ClipboardCopy className="h-5 w-5" /> {/* Copy icon */}
                            </button>
                        )}
                    </div>
                    <button
                        type="submit"
                        className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition duration-200 ease-in-out shadow-md transform active:scale-95"
                    >
                        <Key className="inline-block h-5 w-5 mr-2" /> Join Channel {/* Key icon for join */}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChannelModal;
