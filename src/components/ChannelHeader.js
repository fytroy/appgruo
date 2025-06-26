import React from 'react';
import { Hash, Users } from 'lucide-react'; // Icons

const ChannelHeader = ({ selectedChannelName, channelMembersCount }) => {
    return (
        <header className="bg-white p-4 border-b border-gray-200 shadow-sm flex items-center justify-between z-10">
            {/* Channel Name Display */}
            <h1 className="text-xl font-bold text-gray-900 flex items-center">
                <Hash className="h-5 w-5 mr-2 text-gray-500" /> {/* Icon to represent a channel */}
                {selectedChannelName} {/* Displays the name of the currently selected channel */}
            </h1>
            {/* Channel Members Count Display (conditionally rendered) */}
            {/* It only shows if channelMembersCount is not null, meaning a specific channel is selected (not 'Welcome') */}
            {channelMembersCount !== null && (
                <span className="text-sm text-gray-600 flex items-center">
          <Users className="h-4 w-4 mr-1 text-gray-400" /> {channelMembersCount} Members
        </span>
            )}
        </header>
    );
};

export default ChannelHeader;
