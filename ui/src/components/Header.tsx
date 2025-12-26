import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header({ networkLabel }: { networkLabel: string }) {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <h1 className="header-title">
              EncryptFi
            </h1>
            <span className="header-badge">{networkLabel}</span>
          </div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
