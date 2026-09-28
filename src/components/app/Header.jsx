import Icon from '@/components/app/Icon';

export default function Header({ drawerOpen, onToggle }) {
  return (
    <header className="header">
      <h1 className="header-title">Video to JSON</h1>
      <button className={'btn' + (drawerOpen ? ' active' : '')} onClick={onToggle}>
        <Icon name="sliders" />Settings
      </button>
    </header>
  );
}