import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ProtoProvider } from './proto/ProtoProvider';
import '@cloud-materials/common/es/style/index.css';
import '@cloud-materials/common/es/style/legacy.css';
import './styles/tokens.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ProtoProvider>
      <App />
    </ProtoProvider>
  </React.StrictMode>,
);
