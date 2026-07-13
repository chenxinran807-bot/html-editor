# Native run commands

The experiment used the installed Inspire CLI directly. Identity output was reduced to authentication state before it was saved.

```sh
inspire-prototype whoami --json
inspire-prototype schema 'generate prototype'
inspire-prototype skills visible --json
```

Generation command:

```sh
inspire-prototype generate prototype --prompt '基于所附 PRD 参考图生成一个中文移动端 AI 试穿「创建形象-新增拍照上传」高保真可交互原型。必须覆盖并可真实点击验证：1 打开创建形象并弹出照片来源，明确“拍照/从相册选择”；2 进入相机；3 翻转前后摄像头且状态可见变化；4 打开相册并能返回相机；5 关闭相机回到照片来源；6 快门进入照片确认；7 重拍回相机并保留摄像头方向；8 使用照片进入明确的审核加载态；9 审核失败展示具体合规指导；10 重新上传回到照片来源。还应提供可触发的审核成功分支和审核服务异常/重试，所有可见控件不得是死按钮。使用附件作为视觉参考，但不要把整张带系统控件的截图直接嵌套成相机画面造成双重 UI；可裁切或重构。所有模拟数据/审核结果明确标注为演示，不调用真实摄像头或审核服务。移动端 390×844，中文，优先忠实复现浅绿创建浮层、深色相机、确认页、失败与恢复。' --name camera-upload-native-inspire-20260713 --skill built-in:mobile-shell --file experiments/cells/camera-upload/inspire-prototype/input/assets/image-008.png --file experiments/cells/camera-upload/inspire-prototype/input/assets/image-009.png --file experiments/cells/camera-upload/inspire-prototype/input/assets/image-010.png --file experiments/cells/camera-upload/inspire-prototype/input/assets/image-011.png --file experiments/cells/camera-upload/inspire-prototype/input/assets/image-012.png --file experiments/cells/camera-upload/inspire-prototype/input/assets/image-013.png --type react --fail-on-generation-error --wait --report both --json
inspire-prototype asset 6a54dba21afe4f0267392504 --json
node experiments/cells/camera-upload/inspire-prototype/run/qa-remote-cdp.mjs
```

The first two browser runs exposed QA harness assumptions during page loading and card selection. The corrected run completed. These harness corrections did not change the generated remote asset.
