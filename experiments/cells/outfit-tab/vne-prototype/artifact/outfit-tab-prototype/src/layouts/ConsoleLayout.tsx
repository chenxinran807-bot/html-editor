import { ReactNode } from 'react';
import { Typography } from '@cloud-materials/common';
import ConsoleSidebar from './ConsoleSidebar';

type Props = {
  productTitle: string;
  productLogo?: ReactNode;
  menus: Record<string, unknown>[];
  sidebarDefaultOpenKeys?: string[];
  breadcrumbs?: string[];
  pageTitle: string;
  /** 标题下一行：筛选、搜索等（左侧） */
  headerToolbar?: ReactNode;
  /** 标题下一行：主/次按钮等（右侧，主按钮最右） */
  pageActions?: ReactNode;
  /** 工具行下方：页面大区域 Tab，通常为 CTabs type="card-gutter" */
  headerExtra?: ReactNode;
  children: ReactNode;
};

export default function ConsoleLayout({
  productTitle,
  productLogo,
  menus,
  sidebarDefaultOpenKeys,
  breadcrumbs,
  pageTitle,
  pageActions,
  headerToolbar,
  headerExtra,
  children,
}: Props) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#fff' }}>
      <ConsoleSidebar
        title={productTitle}
        logo={productLogo}
        menus={menus}
        defaultOpenKeys={sidebarDefaultOpenKeys}
      />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'auto',
          background: '#fff',
          padding: '24px 32px',
        }}
      >
        <header style={{ marginBottom: 24 }}>
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <div style={{ marginBottom: 2, color: 'var(--text-3)', fontSize: 12 }}>
              {breadcrumbs.join(' / ')}
            </div>
          ) : null}
          <Typography.Title
            heading={5}
            style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-1)' }}
          >
            {pageTitle}
          </Typography.Title>
          {headerToolbar || pageActions ? (
            <div
              style={{
                marginTop: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {headerToolbar}
              </div>
              {pageActions ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
                  {pageActions}
                </div>
              ) : null}
            </div>
          ) : null}
          {headerExtra ? <div style={{ marginTop: 16 }}>{headerExtra}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}
