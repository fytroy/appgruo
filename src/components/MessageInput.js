import React, { useRef } from 'react';
import { Send, UploadCloud } from 'lucide-react'; // Lucide icons for Send and Upload

const MessageInput = ({ newMessage, setNewMessage, handleSendMessage, handleFileUpload, uploadProgress }) => {
    const fileInputRef = useRef(null); // Create a ref to access the hidden file input element

    // Function to programmatically trigger a click on the hidden file input
    const triggerFileInput = () => {
        fileInputRef.current?.click(); // Safely access and click the input
    };

    return (
        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200 flex items-center shadow-lg relative">
            {/* File Upload Button */}
            <button
                type="button" // Important: Set type to "button" to prevent it from submitting the form
                onClick={triggerFileInput} // Calls the function to open file selection dialog
                className="p-2 mr-2 bg-gray-200 text-gray-600 rounded-full hover:bg-gray-300 transition duration-200 ease-in-out flex items-center justify-center shadow-sm"
                title="Attach File"
            >
                <UploadCloud className="h-5 w-5" /> {/* Icon for file upload */}
            </button>
            {/* Hidden File Input Element */}
            <input
                type="file"
                ref={fileInputRef} // Attach the ref to this input
                onChange={handleFileUpload} // Call the file upload handler when a file is selected
                className="hidden" // Keep the actual file input hidden from the user
            />

            {/* Message Text Input */}
            <input
                type="text"
                value={newMessage} // Controlled component: input value is tied to state
                onChange={(e) => setNewMessage(e.target.value)} // Update state as user types
                placeholder="Message #channel-name" // Placeholder text for the input field
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition duration-200 ease-in-out text-base"
            />
            {/* Send Message Button */}
            <button
                type="submit" // Submits the form when clicked
                className="ml-3 px-5 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition duration-200 ease-in-out shadow-md transform active:scale-95"
            >
                <Send className="h-5 w-5" /> {/* Icon for sending message */}
            </button>

            {/* Upload Progress Bar */}
            {/* Visible only when uploadProgress is between 0 (started) and 100 (not yet completed) */}
            {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="absolute top-0 left-0 right-0 h-2 rounded-t-lg overflow-hidden">
                    <div
                        className="bg-emerald-500 h-full transition-all duration-100 ease-linear"
                        style={{ width: `${uploadProgress}%` }} // Dynamically set width based on progress
                    ></div>
                </div>
            )}
        </form>
    );
};

export default MessageInput;
