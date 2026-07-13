import { useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CSideBar } from '@cloud-materials/common';

type Props = {
  title: string;
  logo?: ReactNode;
  /** Step 4 按 ui-spec 在页面层传入，scaffold 不提供默认菜单 */
  menus: Record<string, unknown>[];
  defaultOpenKeys?: string[];
  collapse?: boolean;
  onCollapseChange?: (collapse: boolean) => void;
};

export default function ConsoleSidebar({
  title,
  logo,
  menus,
  defaultOpenKeys = [],
  collapse: controlledCollapse,
  onCollapseChange,
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [innerCollapse, setInnerCollapse] = useState(false);

  const collapse = controlledCollapse ?? innerCollapse;
  const setCollapse = onCollapseChange ?? setInnerCollapse;
  const selectedKeys = useMemo(() => [location.pathname], [location.pathname]);

  return (
    <CSideBar
      style={{ width: 220, flexShrink: 0, height: '100%' }}
      mode="normal"
      autoCollapse={false}
      title={{ logo, text: title }}
      defaultOpenKeys={defaultOpenKeys}
      selectedKeys={selectedKeys}
      collapse={collapse}
      onCollapseChange={setCollapse}
      menus={menus as any}
      renderMenuItem={(props, { path }) =>
        path ? <Link to={path} {...props} /> : <span {...props} />
      }
      onClickMenuItem={(item) => {
        const target = item.path ?? item.key;
        if (typeof target === 'string' && target.startsWith('/')) {
          navigate(target);
        }
      }}
    />
  );
}
