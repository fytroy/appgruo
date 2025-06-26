import React, { useState, useEffect } from 'react';
import { XCircle, Hash, User, PlusCircle } from 'lucide-react'; // Icons for close, hash, user, plus
import { collection, onSnapshot, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore'; // Firestore operations

const ProfileModal = ({ showProfileModal, setShowProfileModal, currentUserName, currentUserId, db, setAuthError }) => {
    const [isAdminOf, setIsAdminOf] = useState([]); // State to store channels where the current user is an admin
    const [selectedChannelForAdmin, setSelectedChannelForAdmin] = useState(''); // State for selected channel in admin form
    const [newAdminUserId, setNewAdminUserId] = useState(''); // State for the user ID to make admin
    const [localError, setLocalError] = useState(''); // Local error state specific to this modal

    // Effect to fetch channels where the current user is an admin
    useEffect(() => {
        // Only run this effect if Firebase is initialized, user is logged in, and modal is open
        if (!db || !currentUserId || !showProfileModal) return;

        const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
        const channelsCollectionRef = collection(db, `artifacts/${appId}/public/data/channels`);

        // Setup a real-time listener to all channels.
        // This allows us to filter which ones the current user administers.
        const unsubscribe = onSnapshot(channelsCollectionRef, (snapshot) => {
            const adminChannels = [];
            snapshot.docs.forEach(docSnap => {
                const data = { id: docSnap.id, ...docSnap.data() };
                // Check if the current user's ID is in the 'admin' array of the channel
                if (data.admin && data.admin.includes(currentUserId)) {
                    adminChannels.push(data);
                }
            });
            setIsAdminOf(adminChannels); // Update the state with channels the user admins
        }, (error) => {
            console.error("Error fetching admin channels:", error);
            setLocalError("Failed to fetch admin channels."); // Set a local error for the modal
            setAuthError("Failed to fetch admin channels for profile."); // Also set a global error if critical
        });

        return () => unsubscribe(); // Cleanup the listener when the component unmounts or dependencies change
    }, [db, currentUserId, showProfileModal, setAuthError]);


    // Function to handle adding a new admin to a selected channel
    const handleAddAdmin = async (e) => {
        e.preventDefault(); // Prevent default form submission
        setLocalError(''); // Clear any previous local errors

        // Input validation
        if (!selectedChannelForAdmin || !newAdminUserId.trim() || !db) {
            setLocalError("Please select a channel and enter a user ID.");
            return;
        }

        try {
            const appId = process.env.REACT_APP_APP_ID || 'default-app-id';
            const channelRef = doc(db, `artifacts/${appId}/public/data/channels`, selectedChannelForAdmin);
            const channelSnap = await getDoc(channelRef); // Fetch the channel document

            if (!channelSnap.exists()) {
                setLocalError("Selected channel does not exist.");
                return;
            }

            const channelData = channelSnap.data();
            // Permission check: ensure the current user is an admin of this channel
            if (!channelData.admin || !channelData.admin.includes(currentUserId)) {
                setLocalError("You are not an admin of this channel and therefore cannot add new admins.");
                return;
            }
            // Membership check: ensure the target user is already a member of this channel
            if (!channelData.members || !channelData.members.includes(newAdminUserId)) {
                setLocalError("The user ID provided is not a member of this channel. They must join first.");
                return;
            }
            // Redundancy check: ensure the target user is not already an admin
            if (channelData.admin && channelData.admin.includes(newAdminUserId)) {
                setLocalError("This user is already an admin of this channel.");
                return;
            }


            // Update the channel document by adding the new user ID to the 'admin' array
            await updateDoc(channelRef, {
                admin: arrayUnion(newAdminUserId) // Firebase arrayUnion adds if not already present
            });
            setNewAdminUserId(''); // Clear the input field
            setLocalError("Admin added successfully!"); // Display success message
        } catch (error) {
            console.error("Error adding admin:", error);
            setLocalError(`Failed to add admin: ${error.message}`); // Display detailed error
        }
    };

    // If showProfileModal is false, don't render the modal
    if (!showProfileModal) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-xl text-white border border-gray-700 relative">
                {/* Close Button for the modal */}
                <button
                    onClick={() => setShowProfileModal(false)} // Closes the modal
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition duration-200"
                    title="Close"
                >
                    <XCircle className="h-6 w-6" /> {/* Close icon */}
                </button>
                <h3 className="text-2xl font-bold text-center text-emerald-400 mb-6">Your Profile</h3>
                {/* Display Local Errors (specific to this modal's operations) */}
                {localError && (
                    <p className="text-red-500 text-center mb-4 text-sm flex items-center justify-center">
                        <XCircle className="h-4 w-4 mr-2" /> {localError} {/* Error icon and message */}
                    </p>
                )}

                {/* User Information Section */}
                <div className="mb-6 border-b border-gray-700 pb-6">
                    <p className="text-lg font-semibold mb-2">Username: <span className="font-normal text-gray-300">{currentUserName}</span></p>
                    <p className="text-lg font-semibold">Your User ID: <span className="font-normal text-gray-300 break-all">{currentUserId}</span></p>
                </div>

                {/* Admin Management Section (conditionally rendered only if user is an admin of any channel) */}
                {isAdminOf.length > 0 && (
                    <div className="mb-6 border-b border-gray-700 pb-6">
                        <h4 className="text-xl font-bold text-emerald-300 mb-4">Channels You Administer:</h4>
                        <ul className="list-disc list-inside space-y-2">
                            {/* List all channels the user is an admin of */}
                            {isAdminOf.map(channel => (
                                <li key={channel.id} className="flex items-center text-gray-300">
                                    <Hash className="h-4 w-4 mr-2 text-gray-500" /> {/* Channel icon */}
                                    {channel.name} (<span className="text-xs text-gray-500 break-all">{channel.id}</span>) {/* Display channel name and full ID */}
                                </li>
                            ))}
                        </ul>

                        {/* Form to Add Admin to a Channel */}
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
                                    onChange={(e) => setSelectedChannelForAdmin(e.target.value)} // Update state on selection
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
                                    onChange={(e) => setNewAdminUserId(e.target.value)} // Update state on input change
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition duration-200 ease-in-out shadow-md transform active:scale-95 flex items-center justify-center"
                            >
                                <PlusCircle className="h-5 w-5 mr-2" /> Add as Admin {/* Plus icon for adding admin */}
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

export default ProfileModal;
