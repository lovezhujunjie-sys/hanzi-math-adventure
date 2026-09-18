#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把 tmp/g2_hanzi.json（部编版二年级生字表调研结果）编译成 src/03b_data_g2.js
🔴 真源是 tmp/g2_hanzi.json，不要手改生成的 js —— 改了下次重跑会被覆盖。
🔴 输出的汉字一律用 Unicode NFC 规范化：macOS 上从网页抓来的中文可能是 NFD，
   直接写进文件会让「诗」在 App 里比对不相等（历史上踩过这个坑）。
"""
import json, io, os, unicodedata as ud

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tmp', 'g2_hanzi.json')
UNITS = os.path.join(ROOT, 'tmp', 'g2_units.json')   # 单元主题（歌/课文名），可选
OUT = os.path.join(ROOT, 'src', '03b_data_g2.js')

N = lambda s: ud.normalize('NFC', s)


def q(s):
    """JS 单引号字符串字面量"""
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"


def main():
    raw = json.load(io.open(SRC, encoding='utf-8'))
    # 单元主题是可选的：拿不到就退化成「第一单元」，绝不编一个主题名糊上去
    themes = {}
    if os.path.exists(UNITS):
        ud = json.load(io.open(UNITS, encoding='utf-8'))
        for bk, arr in ud.items():
            if not isinstance(arr, list):      # 文件里还有 notes 之类的说明键，跳过
                continue
            for it in arr:
                themes[(bk, int(it['u']))] = (N(it.get('theme', '')), it.get('emoji', ''))
    books = []
    for bid, (bkey, bname) in enumerate([('上册', '二年级上册'), ('下册', '二年级下册')]):
        units = {}
        for k, arr in raw[bkey].items():
            # '第一单元·写字表'
            uname, kind = k.split('·')
            u = units.setdefault(uname, {'xie': [], 'shi': []})
            key = 'xie' if kind == '写字表' else 'shi'
            seen = {r[0] for r in u[key]}
            for it in arr:
                z = N(it['z'])
                py = N(it['py']).strip()
                ci = [N(c) for c in it['ci'] if c and N(c).strip()]
                if len(z) != 1 or not py or len(ci) < 2:
                    continue
                # 组词必须含本字，否则是张冠李戴
                if not all(z in c for c in ci):
                    continue
                if z in seen:
                    continue
                seen.add(z)
                u[key].append([z, py, ci[0], ci[1]])
        order = ['第一单元', '第二单元', '第三单元', '第四单元', '第五单元',
                 '第六单元', '第七单元', '第八单元']
        units_out = []
        for i, uname in enumerate(order):
            u = units.get(uname)
            if not u:
                continue
            th, em = themes.get((bkey, i + 1), ('', ''))
            units_out.append({'u': i + 1, 'name': uname, 'theme': th, 'emoji': em,
                              'xie': u['xie'], 'shi': u['shi']})
        books.append({'id': 's%d' % (bid + 1), 'name': bname,
                      'short': '二' + ('上' if bid == 0 else '下'),
                      'units': units_out})

    L = []
    L.append('/* ' + '═' * 62)
    L.append('   HANZI_G2 —— 部编版小学二年级生字表（曾麟轩用）')
    L.append('   🔴 由 tools/build_g2.py 从 tmp/g2_hanzi.json 生成，不要手改这个文件。')
    L.append('   🔴 数据格式：[汉字, 拼音, 组词1, 组词2]——用数组不用对象，')
    L.append('      1100 多个字，省下来的每一字节都是孩子手机上少等的一毫秒。')
    L.append('   🔴 xie=写字表（要会写），shi=识字表（认得就行）。')
    L.append('   ' + '═' * 62 + ' */')
    L.append('const HANZI_G2 = {')
    L.append('  books: [')
    for b in books:
        L.append('    {id:%s, name:%s, short:%s, units:[' %
                 (q(b['id']), q(b['name']), q(b['short'])))
        for u in b['units']:
            L.append('      {u:%d, name:%s, theme:%s, emoji:%s,' %
                     (u['u'], q(u['name']), q(u['theme']), q(u['emoji'])))
            for key in ('xie', 'shi'):
                rows = u[key]
                L.append('        %s: [' % key)
                buf = []
                for r in rows:
                    buf.append('[%s,%s,%s,%s]' % (q(r[0]), q(r[1]), q(r[2]), q(r[3])))
                # 每行 4 条，方便 diff
                for i in range(0, len(buf), 4):
                    L.append('          ' + ','.join(buf[i:i + 4]) + ',')
                L.append('        ],')
            L.append('      },')
        L.append('    ]},')
    L.append('  ],')
    L.append('  /* 全部字去重后的池子（认字闯关用），惰性建一次就缓存 */')
    L.append('  _pool: null,')
    L.append('  pool() {')
    L.append('    if (this._pool) return this._pool;')
    L.append('    const seen = new Set(), out = [];')
    L.append('    for (const b of this.books) for (const u of b.units) {')
    L.append('      for (const key of [\'xie\', \'shi\']) for (const r of u[key]) {')
    L.append('        if (seen.has(r[0])) continue;')
    L.append('        seen.add(r[0]);')
    L.append('        out.push({ z: r[0], py: r[1], ci: [r[2], r[3]], book: b.short, unit: u.name });')
    L.append('      }')
    L.append('    }')
    L.append('    this._pool = out;')
    L.append('    return out;')
    L.append('  }')
    L.append('};')

    io.open(OUT, 'w', encoding='utf-8').write('\n'.join(L) + '\n')

    nx = sum(len(u['xie']) for b in books for u in b['units'])
    ns = sum(len(u['shi']) for b in books for u in b['units'])
    allz = set()
    for b in books:
        for u in b['units']:
            for k in ('xie', 'shi'):
                for r in u[k]:
                    allz.add(r[0])
    print('写字表 %d 字 · 识字表 %d 字 · 合计 %d 条 · 去重后 %d 个不同的字' %
          (nx, ns, nx + ns, len(allz)))
    print('单元数：', [(b['short'], len(b['units'])) for b in books])
    print('输出：', OUT, os.path.getsize(OUT), '字节')


if __name__ == '__main__':
    main()
