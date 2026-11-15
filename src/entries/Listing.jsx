import React from 'react';
import '../styles/interaction.css';
import { createRoot } from 'react-dom/client';
import Listing from '../generated/Listing.jsx';

createRoot(document.getElementById('root')).render(<Listing />);
