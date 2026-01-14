import React from 'react';

const Loader: React.FC = () => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      width: '100%',
      position: 'absolute',
      top: 0,
      left: 0,
      backgroundColor: 'rgba(17, 17, 17, 0.8)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999,
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        display: 'inline-block',
        borderTop: '3px solid #9E7FFF',
        borderRight: '3px solid transparent',
        boxSizing: 'border-box',
        animation: 'rotation 1s linear infinite',
      }}></div>
      <style>{`
        @keyframes rotation {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default Loader;
