// Trang Trợ lý mặt bằng (/tro-ly/): viết tay bằng React, không còn sinh từ design/.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/interaction.css';
import '../assistant/assistant.css';
import Assistant from '../assistant/Assistant.jsx';

createRoot(document.getElementById('root')).render(<Assistant />);
