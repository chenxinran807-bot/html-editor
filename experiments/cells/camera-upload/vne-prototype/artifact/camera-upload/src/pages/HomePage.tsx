import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  IconApps,
  Modal,
  Space,
  Spin,
  Typography,
} from '@cloud-materials/common';
import ConsoleLayout from '../layouts/ConsoleLayout';
import { useProto } from '../proto/ProtoProvider';
import './camera-upload.css';

type Screen = 'home' | 'camera' | 'album' | 'confirm' | 'reviewing' | 'failed';

const menus = [{ type: 'menu', key: '/', path: '/', label: '拍照上传', icon: <IconApps /> }];

export default function HomePage() {
  const proto = useProto();
  const [screen, setScreen] = useState<Screen>('home');
  const [sourceOpen, setSourceOpen] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const uploadRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (screen !== 'reviewing') return;
    const timer = window.setTimeout(() => setScreen('failed'), 900);
    return () => window.clearTimeout(timer);
  }, [screen]);

  const openSources = () => {
    setScreen('home');
    setSourceOpen(true);
  };
  const enterCamera = () => {
    setPermissionDenied(false);
    setSourceOpen(false);
    setScreen('camera');
  };

  return (
    <ConsoleLayout
      productTitle="AI 试穿"
      productLogo={<IconApps style={{ fontSize: 20 }} />}
      menus={menus}
      pageTitle={<span data-proto-key="page.title">{proto.get('page.title') as string}</span>}
      headerToolbar={<Typography.Text type="secondary">创建清晰、合规的试穿形象</Typography.Text>}
      pageActions={<Button onClick={() => setPermissionDenied((value) => !value)}>切换权限示例</Button>}
    >
      <div className="workspace" data-proto-key="token.primary" style={{ '--prototype-primary': proto.get('token.primary') } as CSSProperties}>
        <Card className="guide-card" title="拍照上传流程">
          <Typography.Paragraph>现场拍摄能减少用户在相册中寻找合格照片的成本，并在提交前提供明确反馈。</Typography.Paragraph>
          <ol>
            <li>选择拍照或相册</li>
            <li>拍摄并确认照片</li>
            <li>审核照片质量</li>
            <li>失败时根据指导重新上传</li>
          </ol>
          {permissionDenied ? (
            <div id="permission-alert"><Alert type="warning" title="相机权限未开启" content="请在浏览器设置中允许访问相机，然后重试。" /></div>
          ) : null}
        </Card>

        <Card className="preview-card" title="交互预览">
          <div className={`device screen-${screen}`} data-facing={facing} data-testid="device">
            {screen === 'home' ? (
              <div className="home-state">
                <div className="photo-placeholder" aria-hidden="true">＋</div>
                <Typography.Title heading={5}>上传一张面部清晰照片</Typography.Title>
                <Typography.Text type="secondary">正脸、无遮挡、仅一人入镜</Typography.Text>
                <Button
                  ref={uploadRef}
                  id="upload-photo"
                  data-proto-key="upload.cta"
                  type="primary"
                  size="large"
                  onClick={() => setSourceOpen(true)}
                >
                  {proto.get('upload.cta') as string}
                </Button>
              </div>
            ) : null}

            {screen === 'camera' ? (
              <div className="camera-state">
                <img src="assets/camera.png" alt="相机预览" />
                <Button id="close-camera" className="camera-close" aria-label="关闭相机" shape="circle" onClick={openSources}>×</Button>
                <Button id="flip-camera" className="camera-flip" onClick={() => setFacing((value) => value === 'back' ? 'front' : 'back')}>翻转 · {facing === 'back' ? '后置' : '前置'}</Button>
                <Button id="open-album" className="album-action" onClick={() => setScreen('album')}>相册</Button>
                <Button id="shutter" className="shutter" aria-label="拍照" onClick={() => setScreen('confirm')} />
              </div>
            ) : null}

            {screen === 'album' ? (
              <div className="album-state">
                <Typography.Title heading={5}>最近项目</Typography.Title>
                <div className="album-grid">
                  <button id="album-photo" onClick={() => setScreen('confirm')}><img src="assets/captured.png" alt="最近照片" /></button>
                </div>
                <Empty description="原型仅提供一张本地示例照片" />
              </div>
            ) : null}

            {screen === 'confirm' ? (
              <div className="confirm-state">
                <img src="assets/captured.png" alt="已拍摄照片" />
                <div className="confirm-actions">
                  <Button id="retake" size="large" onClick={() => setScreen('camera')}>重拍</Button>
                  <Button id="use-photo" type="primary" size="large" onClick={() => setScreen('reviewing')}>使用照片</Button>
                </div>
              </div>
            ) : null}

            {screen === 'reviewing' ? (
              <div className="review-state" aria-live="polite"><Spin size={40} /><Typography.Title heading={5}>正在审核照片</Typography.Title><Typography.Text type="secondary">正在检查清晰度与人物信息…</Typography.Text></div>
            ) : null}

            {screen === 'failed' ? (
              <div className="failed-state" aria-live="assertive">
                <div className="failure-icon">!</div>
                <Typography.Title heading={4} data-proto-key="review.failureTitle">{proto.get('review.failureTitle') as string}</Typography.Title>
                <Alert type="error" title="照片内容不符合规范" content="请使用清晰正脸、无遮挡且仅一人入镜的照片。" />
                <Space direction="vertical" size={12}>
                  <Typography.Text>✓ 正脸照片　✓ 面部无遮挡　✓ 仅一人入镜</Typography.Text>
                  <Button id="retry" type="primary" size="large" onClick={openSources}>重新上传</Button>
                </Space>
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <Modal
        title="选择照片来源"
        visible={sourceOpen}
        footer={null}
        autoFocus={false}
        focusLock
        onCancel={() => {
          setSourceOpen(false);
          window.setTimeout(() => uploadRef.current?.focus(), 0);
        }}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Button id="choose-camera" type="primary" long size="large" disabled={permissionDenied} onClick={enterCamera}>拍照</Button>
          <Button id="choose-album" long size="large" onClick={() => { setSourceOpen(false); setScreen('album'); }}>从相册选择</Button>
        </Space>
      </Modal>
    </ConsoleLayout>
  );
}
