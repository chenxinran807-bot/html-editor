const channels = {
  '按场景': ['推荐', '日常', '通勤', '约会', '出游', '运动', '校园'],
  '适合我': ['不限性别', '男生', '女生', '小个子', '高个子', '梨形', '宽肩', '暖肤色', '冷肤色'],
  '博主推荐': ['精选', '关注', '新锐', '男生穿搭', '女生穿搭'],
};

const rawCards = [
  ['creator', 'creator-1', '清爽通勤灵感', ['通勤', '简洁'], ['推荐', '通勤'], ['不限性别', '男生', '宽肩'], ['精选', '关注', '男生穿搭'], { reason: '配色清晰，适合日常参考', authorId: 'author-1' }],
  ['collection', 'collection-1', '周末出游穿搭集', ['出游', '轻松'], ['出游'], ['女生', '暖肤色'], ['精选', '女生穿搭'], { description: '从早到晚的轻松搭配思路', count: 6 }],
  ['outfit', 'outfit-1', '城市散步搭配', ['日常', '层次'], ['日常'], ['不限性别', '高个子'], ['新锐'], { reason: '层次简单，方便活动', itemCount: 3 }],
  ['creator', 'creator-2', '校园活力日记', ['校园', '活力'], ['校园'], ['男生', '小个子'], ['新锐', '男生穿搭'], { reason: '比例利落，适合校园活动', authorId: 'author-2' }],
  ['collection', 'collection-2', '柔和约会色系', ['约会', '柔和'], ['约会'], ['女生', '梨形', '冷肤色'], ['关注', '女生穿搭'], { description: '柔和色彩与轮廓的组合参考', count: 5 }],
  ['outfit', 'outfit-2', '轻运动叠穿思路', ['运动', '叠穿'], ['运动'], ['不限性别', '宽肩'], ['精选'], { reason: '动作方便，层次不累赘', itemCount: 4 }],
  ['creator', 'creator-3', '小个子通勤笔记', ['通勤', '比例'], ['通勤'], ['女生', '小个子'], ['关注', '女生穿搭'], { reason: '纵向线条明确，搭配易参考', authorId: 'author-3' }],
  ['collection', 'collection-3', '高个子日常廓形', ['日常', '廓形'], ['日常', '推荐'], ['男生', '高个子'], ['男生穿搭'], { description: '不同长度单品的廓形组合', count: 7 }],
  ['outfit', 'outfit-3', '暖色出游搭配', ['出游', '暖色'], ['出游'], ['暖肤色', '梨形'], ['新锐', '女生穿搭'], { reason: '暖色调统一，适合户外氛围', itemCount: 3 }],
  ['creator', 'creator-4', '冷色约会提案', ['约会', '冷色'], ['约会'], ['冷肤色', '不限性别'], ['精选', '新锐'], { reason: '冷色搭配干净，视觉节奏舒缓', authorId: 'author-4' }],
  ['collection', 'collection-4', '宽肩运动廓形', ['运动', '廓形'], ['运动'], ['男生', '宽肩'], ['关注', '男生穿搭'], { description: '兼顾伸展度与轮廓平衡', count: 4 }],
  ['outfit', 'outfit-4', '轻松校园组合', ['校园', '舒适'], ['校园', '推荐'], ['女生', '小个子'], ['女生穿搭'], { reason: '简单实穿，适合连续活动', itemCount: 4 }],
];

export function createCatalog() {
  return {
    channels: Object.fromEntries(Object.entries(channels).map(([name, filters]) => [name, [...filters]])),
    cards: rawCards.map(([type, id, title, tags, scenes, people, creators, details], originalIndex) => ({
      id,
      type,
      title,
      tags: [...tags],
      assetPath: `./assets/${id}.svg`,
      filters: { '按场景': [...scenes], '适合我': [...people], '博主推荐': [...creators] },
      originalIndex,
      ...details,
    })),
  };
}
