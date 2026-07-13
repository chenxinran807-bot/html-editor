import { Button, Card, Drawer, Message, Modal, Space, Tag, Tabs } from '@cloud-materials/common';
import { useState } from 'react';
import outfit from '../assets/outfit.png';
import { useProto } from '../proto/ProtoProvider';

const categories: Record<string, string[]> = {
  '博主精选': ['博主同款', '复古通勤'],
  '场景适配': ['通勤', '出游'],
  '身型适配': ['小个子', '梨形'],
};

export default function HomePage() {
  const proto = useProto();
  const [category, setCategory] = useState('博主精选');
  const [detail, setDetail] = useState(false);
  const [product, setProduct] = useState(false);
  const [ai, setAi] = useState(false);
  const [liked, setLiked] = useState(false);
  return <main className="phone-shell">
    <header><b data-proto-key="page.title">{proto.get('page.title') as string}</b><span>直播</span><span>推荐</span>⌕</header>
    <Tabs activeTab={category} onChange={setCategory} type="rounded">
      {Object.keys(categories).map(k => <Tabs.TabPane key={k} title={k} />)}
    </Tabs>
    <section className="feed" data-testid="feed">
      {categories[category].map((tag, i) => <Card key={tag} className="look-card" hoverable onClick={() => setDetail(true)}>
        <img src={outfit} alt="复古牛仔外套穿搭" />
        <div className="card-body"><Space><Tag color="lime">{tag}</Tag><Tag color="lime">{i ? '成套可买' : '高个子'}</Tag></Space>
        <h3>{i ? '蓝白约会套装，整套可买' : '牛仔外套 + 低腰微喇牛仔裤'}</h3>
        <p>适合轻通勤与复古风，短外套提高腰线</p>
        <Space><Button size="mini" onClick={e => { e.stopPropagation(); setLiked(!liked); Message.success(liked ? '已减少类似推荐' : '会为你推荐更多类似穿搭'); }}>{liked ? '已喜欢' : '♡ 喜欢'}</Button><Button size="mini" onClick={e => { e.stopPropagation(); Message.info('已减少类似推荐'); }}>× 不喜欢</Button></Space></div>
      </Card>)}
    </section>
    <Drawer width="100%" visible={detail} onCancel={() => setDetail(false)} title="穿搭详情" footer={null}>
      <div className="detail"><img src={outfit} alt="穿搭详情" /><h2>复古牛仔外套叠穿酒红内搭</h2>
      <h3>适合人群</h3><p>适合 <mark>高个子</mark>、轻通勤和喜欢 <mark>复古红风</mark> 的人群。</p>
      <h3>配色公式</h3><p>深牛仔压住轮廓，酒红内搭提气色，棕色皮质托特增强复古感。</p>
      <h3>避雷提醒</h3><p>小个子建议换短款外套；胯宽用户避免过紧低腰裤，面料优先选有垂感款。</p>
      <Space wrap><Button type="primary" onClick={() => setProduct(true)}>查看同款 ¥358</Button><Button onClick={() => setProduct(true)}>低价平替 ¥199</Button><Button status="success" onClick={() => setAi(true)}>AI 试穿</Button></Space></div>
    </Drawer>
    <Modal visible={product} title="商品信息" onCancel={() => setProduct(false)} onOk={() => Message.success('已加入购物车')} okText="加入购物车">
      <h3>复古牛仔短外套</h3><p>¥358 · 深蓝色 · S/M/L</p><p>平替款 ¥199，版型相近，棉含量 82%。</p>
    </Modal>
    <Modal visible={ai} title="AI 继续帮你搭" onCancel={() => setAi(false)} footer={null}>
      <p>保留当前牛仔外套，继续生成一套更日常的搭配。</p><Space><Button type="primary" onClick={() => Message.success('已开始生成同款延展')}>同款延展</Button><Button onClick={() => Message.success('已进入 AI 试穿')}>进入 AI 试穿</Button></Space>
    </Modal>
  </main>;
}
