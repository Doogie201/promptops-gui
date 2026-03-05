import { mountDashboardApp } from './dashboard_app.ts';
import { createBrowserOperatorApi } from './operator_api_browser.ts';
import './styles.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) {
  throw new Error('S17 dashboard root element (#app) not found.');
}

mountDashboardApp(root, createBrowserOperatorApi());
