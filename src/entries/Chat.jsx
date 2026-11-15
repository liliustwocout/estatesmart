import React from 'react';
import '../styles/interaction.css';
import { createRoot } from 'react-dom/client';
import Chat from '../generated/Chat.jsx';

createRoot(document.getElementById('root')).render(<Chat />);
