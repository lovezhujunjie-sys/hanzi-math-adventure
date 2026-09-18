# -*- coding: utf-8 -*-
"""生成「点字注音」要用的拼音表 → src/03c_data_pinyin.js

用法： node tools/corpus.js > /tmp/corpus.json && python3 tools/build_pinyin.py

═══ 为什么要有这个文件 ═══
老曾要的是「不认识的字点一下出拼音」。难点**不在弹气泡，在拼音不能给错**——
给二年级孩子看的拼音错一个，比不做还糟。所以判据必须只有一处实现，就是这个脚本。

═══ 三层数据 ═══
  PY_CHAR  字 → 默认读音        （全量，1651 字，任何字都有兜底）
  PY_SEG   片段 → 整段拼音       （只存「默认读音在该片段里是错的」那些，按词消歧）
  PY_AMB   哪些字是多音字        （给测试用：PY_SEG 里改过音的字，一个都不能漏在这串外面）

运行时：点到一个字 → 先在点的那个文本节点里找**最长的 PY_SEG 片段**命中 → 用它的读音；
        没命中就用 PY_CHAR 的默认读音。

═══ 一条贯穿全表的取舍（改之前先想清楚要不要推翻它）═══
  **多音字按词定音；变调/轻声给本调。**
  为什么分开：多音字的两个读音是**两个字**（数是 shǔ 还是 shù，是「数一数」和「数目」），
  点字必须按上下文给对的那个；而「一/不」的变调、语气词「呀/啦/哇/哩」的轻声
  是**同一个字**在说话时弱化，课本的生字注音一律标本调，孩子单独点开一个字
  问的是「这个字念什么」。所以前者逐词写进 MANUAL_SEG，后者锁死在本调。
  ⚠️ 认汉字卡片上的拼音来自课本数据（03b_data_g2.js），不是这张表，两者不冲突。

═══ 两道防倒退的闸门（条数见脚本每次运行打印的数字，别在这儿写死）═══
  ① tools/pinyin_reviewed.txt：一批「pypinyin 在猜」的位置逐条看下来，一部分它是对的
     （进了 MANUAL_SEG），剩下的是「默认对、它在猜错」。那几处凭什么说默认对？
     **因为人看过**。以后改了文案、冒出一处没人复核过的多音字用法，构建会直接红。
  ② tools/pinyin_default_reviewed.txt：**「多音字走默认读音」的每个上下文**。
     🔴 为什么非要第二道：第一道只在「pypinyin 跟我们的默认打架」时才叫，
     两边**一致地错**它就一声不吭。上线后看第一张截图抓到的「每行」正是这个洞——
     默认 xíng、pypinyin 也判 xíng，孩子被安安静静教了错音。
  两份快照都靠 `--update-review` 重新冻结，跑之前必须先读 /tmp/pinyin_report.txt
  对应那一节，逐条确认过。

═══ 为什么默认读音不能只用「语料里出现最多」═══
  ① 课本生字表是权威：那 1128 个字孩子正在学，读音以课本为准。
  ② 语料的众数有坑：「着」在最常见的组合里是轻声 zhe，但按字数统计会飘；
     还有「肚」在某些词里是 dǔ（肚子＝牲口的胃），孩子要的是 dù。
     这类一律进 MANUAL_DEFAULT，**每条都写清楚为什么**。
"""
import json, io, re, os, sys, collections
from pypinyin import pinyin, Style
from pypinyin.constants import PHRASES_DICT

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', '03c_data_pinyin.js')
REVIEW = os.path.join(ROOT, 'tools', 'pinyin_reviewed.txt')
# 第二份快照：「多音字走默认读音」的上下文（堵「两边一致地错」，见 main 里那一节）
REVIEW2 = os.path.join(ROOT, 'tools', 'pinyin_default_reviewed.txt')
CJK = re.compile(r'[\u4e00-\u9fa5]')

# ── 人工定音：语料众数在这里不适用的情况 ─────────────────────────────
# 每一条都要有理由，否则半年后没人敢动。
MANUAL_DEFAULT = {
    # 「着」的义项太多，逐字统计会被轻声带偏；孩子单独点到它时，读 zhe（「看着」）最常见也最安全。
    '着': 'zhe',
    # 「肚」语料里 dǔ（猪肚子＝猪胃）压过 dù；孩子学的是「肚子/肚皮」＝dù。
    '肚': 'dù',
    # 「片」在「照片」里口语念 piān，但字典是 zhàopiàn；而且「一片/薄片」都是 piàn。
    '片': 'piàn',
    # 「系」语料里是「系鞋带」的 jì；但「关系/系统」的 xì 才是孩子最先该认的读音。
    '系': 'xì',
    # 「咱」pypinyin 把「咱家」标成 zá，普通话是 zán。
    '咱': 'zán',
    # 「谁」标准音 shuí（课本注 shuí），shéi 是口语音——点字给标准音。
    '谁': 'shuí',
    # 下面三个是语气词/后缀，单字点开时给**本调**，不给轻声：
    # 孩子查的是「这个字念什么」，不是「它在这句里怎么弱读」。
    '呀': 'yā', '啦': 'lā', '哇': 'wā',
    # 「一」「不」的变调（一个 yí ge、不是 bú shì）是**说话**的规律，
    # 课本给单字注音一律标本调，点字也照课本。
    '一': 'yī', '不': 'bù',
    # 后缀/叠词里的轻声同理：弟弟 dì di、婆婆 pó po、伯伯 bó bo——
    # 点单字给 dì/pó/bó，孩子认字认的是本调。
    '弟': 'dì', '婆': 'pó', '伯': 'bó', '头': 'tóu', '子': 'zǐ', '个': 'gè',
    # 「哩」跟「呀/啦/哇」一样是语气词，单字点开给本调 lī，不给轻声。
    '哩': 'lī',
    # 「行」：语料里 22,009 处里 22,002 处是「排/行」义（每行/个一行/最后一行/N 行），
    #   xíng 只有航行/旅行/行驶/举行/就行 7 处。默认给 háng，xíng 的那几个词进 MANUAL_SEG。
    #   🔴 反过来（默认 xíng）不行：数学题里「4 行」这种是数字把「行」切出来单词成段的，
    #      有 6825 处，得把「0 行…9 行」每种写法都枚举进去才算修完，漏一种就错一种。
    #   ⚠️ 这条不是「行这个字在汉语里读 háng」，是「**在我们这个 App 的文字里**它读什么」。
    '行': 'háng',
}

# ── 锁死、永远不按上下文改读音的字 ──
# 「一」和「不」的变调（一个 yí ge、不是 bú shì）是**说话**的规律，不是字的读音；
# 课本给单字注音一律标本调。孩子点开一个字是在问「这个字念什么」，给本调。
# 段一级照抄 pypinyin 就会写成 yí/bú，跟课本打架——所以这两个字锁死。
LOCKED = {'一', '不'}

# ── 人工定音：整段/整词的读音（pypinyin 会判错、但确实在 App 里出现的）──
MANUAL_SEG = {
    # pypinyin 把「一行」判成 yī xíng；这里是「每 5 个一行」＝排成一行，读 háng。
    '一行': 'yī háng',
    # 「咱家」pypinyin 给 zá，普通话 zán。
    '咱家': 'zán jiā',
    # 「照片」pypinyin 给 piān；按字典是 zhào piàn（片已是默认 piàn，这条可省但留着更稳）。
    '照片': 'zhào piàn',
    # 「系上」「系鞋带」都是 jì（打结义），不是 xì。
    '系上': 'jì shàng',
    # 「仔猪」按《现代汉语词典》是 zǐ zhū（pypinyin 给 zǎi）。
    '仔猪': 'zǐ zhū',

    # ═══ 以下这 8 组，是「词典没覆盖、pypinyin 在猜」的 151 处逐条看下来的结论 ═══
    # 判法只有一条：**谁对用谁**。pypinyin 对 → 写进这里；我们的默认对 → 什么都不做
    # （代码本来就用默认，不用为它写条目）。所以下面只是「pypinyin 判对了」的那些。

    # 「数」：单字默认 shǔ（课本二上生字表就注 shǔ），但数学题里当「数目」讲的
    #   数一律 shù。左边带量词/位的都是这个义项，逐词点名。
    '位数': 'wèi shù', '个数': 'gè shù', '颗数': 'kē shù', '块数': 'kuài shù',
    '本数': 'běn shù', '张数': 'zhāng shù', '余数': 'yú shù',
    # 「X的个数是Y的 3 倍」里量词可能为空，剩下的「数是」还是 shù。
    '数是': 'shù shì',
    # 「填括号里的数」——用整串当键，别用「的数」（会跟「数学」抢同一个位置）。
    '括号里的数': 'kuò hào lǐ de shù',
    # 反过来的那些（数一数／一个一个数／先数手指头／数到十／数到三就睡觉／
    # 一个一个点着数）默认 shǔ 就是对的，**不写**。

    # 「得」：默认 de（跑得快、飞得高、一屏装得下都是轻声）。「得到」和乘法口诀
    #   「二二得四」的得是 dé，写死。得一…得九 顺带盖住「三几得九」这种填空口诀。
    '得到': 'dé dào', '得多少': 'dé duō shǎo',
    '得一': 'dé yī', '得二': 'dé èr', '得三': 'dé sān', '得四': 'dé sì',
    '得五': 'dé wǔ', '得六': 'dé liù', '得七': 'dé qī', '得八': 'dé bā',
    '得九': 'dé jiǔ',

    # 「子」：单字默认 zǐ（课本认字），但下面这些是轻声后缀词，读 zi。
    '本子': 'běn zi', '勺子': 'sháo zi', '谷子': 'gǔ zi', '格子': 'gé zi',
    '杏子': 'xìng zi', '胡子': 'hú zi', '村子': 'cūn zi', '哨子': 'shào zi',
    '金子': 'jīn zi', '料子': 'liào zi', '虫子': 'chóng zi', '橙子': 'chéng zi',
    '蹄子': 'tí zi', '包子': 'bāo zi',

    # 「弹」：默认 tán（弹奏 tán zòu 是对的，不写）。弹珠是 dàn。
    '弹珠': 'dàn zhū',

    # 「教」：默认 jiāo（教课、教书是动词，课本注 jiāo，是对的，不写）。
    #   下面四个是名词义的 jiào。教课被 pypinyin 判成 jiào 是它错，不跟。
    '教室': 'jiào shì', '教诲': 'jiào huì', '教训': 'jiào xùn', '教育': 'jiào yù',

    # 「背」：默认 bēi（课本这一课就教「背包/背着」＝bēi，是对的，不写）。
    #   背诵义是 bèi，出现在口诀和闯关里。
    '抽背': 'chōu bèi', '背一遍': 'bèi yī biàn',

    # 「扎」：默认 zā（扎辫子），风筝是 zhā。
    '扎风筝': 'zhā fēng zheng',

    # 「行」：默认 háng（见 MANUAL_DEFAULT），下面这些是 xíng 的词，逐条点名。
    #   语料里真出现过的：航行(×2) 旅行 行驶 举行 就行(×2)；
    #   后面几个是防着以后改文案写进去的（多一条查不到的死条目无害）。
    '航行': 'háng xíng', '旅行': 'lǚ xíng', '行驶': 'xíng shǐ', '举行': 'jǔ xíng',
    '就行': 'jiù xíng', '不行': 'bù xíng', '行走': 'xíng zǒu', '行人': 'xíng rén',
    '行李': 'xíng lǐ', '进行': 'jìn xíng', '自行车': 'zì xíng chē',
    # 「每行」「最后一行」默认 háng 就对，不用写；写出来只是让气泡多显示那个词。
    '每行': 'měi háng', '最后一行': 'zuì hòu yī háng',

    # 「长」：课本单字注 zhǎng（长大/长出来/茁长，默认就是它，不写）。
    #   数学题里「四条边一样长」是 cháng，×2046 处，而且能点——必须点名。
    #   后面几个是语料里的 cháng 义（长颈鹿/长蛇/长龙/长裤/长短）。
    '一样长': 'yī yàng cháng', '长短': 'cháng duǎn', '长蛇': 'cháng shé',
    '长龙': 'cháng lóng', '长裤': 'cháng kù', '长颈鹿': 'cháng jǐng lù',
    '长脖': 'cháng bó',

    # 「得」默认 de（跑得快）。「值得」是 dé。
    '值得': 'zhí dé',
    # 「发」默认 fā（发现/出发/发芽）。「头发」是 fà。
    '头发': 'tóu fà',
    # 「大夫」＝医生，读 dài fu（大不是默认的 dà、夫按本调 fū 写，跟全表口径一致）。
    '大夫': 'dài fū',

    # 「只」默认 zhǐ（只有/只是，语料里的「数据只存在这台电脑」也是 zhǐ，都对，不写）。
    #   「两只手」是量词的 zhī（×2，在数手指的题里）。
    '两只': 'liǎng zhī',
}


def main():
    # 位置参数是语料路径，带 -- 的是开关——别把 --update-review 当成路径。
    positional = [a for a in sys.argv[1:] if not a.startswith('--')]
    corpus_path = positional[0] if positional else '/tmp/corpus.json'
    frags = json.loads(io.open(corpus_path, encoding='utf-8').read())

    # ── 切片段：数字、标点、emoji、HTML 标签都切开，剩下的中文连读才算一段 ──
    segs = collections.Counter()
    for fr in frags:
        for s in re.split(r'[^\u4e00-\u9fa5]+', re.sub(r'<[^>]+>', ' ', fr)):
            if s:
                segs[s] += 1
    print('语料里会显示的中文片段：%d 个' % len(segs))

    # ── 逐段取「词级消歧」读音；同时统计每个字的读音分布 ──
    seg_py = {}
    dist = collections.defaultdict(collections.Counter)
    for s in segs:
        py = [p[0] for p in pinyin(s, style=Style.TONE)]
        seg_py[s] = py
        for ch, p in zip(s, py):
            dist[ch][p] += 1
    print('孩子能看到的不同的字：%d 个' % len(dist))

    # ── 默认读音：课本生字表 > 人工定音 > 语料众数 ──
    # 课本表从 03b_data_g2.js / 03_data_hanzi.js 里读——**不在这个脚本里另算一套**，
    # 否则就是「判据分叉」（吃过这个亏）。
    #   两种格式：二年级 ['字','pīn','组词1','组词2']；二宝 {z:'字', py:'pīn', ...}
    kb = {}
    for f in ['03b_data_g2.js', '03_data_hanzi.js']:
        raw = io.open(os.path.join(ROOT, 'src', f), encoding='utf-8').read()
        for m in re.finditer(r"\['([一-龥])','([^']+)'", raw):
            kb.setdefault(m.group(1), m.group(2))
        for m in re.finditer(r"\{z:'([一-龥])',\s*py:'([^']+)'", raw):
            kb.setdefault(m.group(1), m.group(2))
    print('课本生字表读到：%d 个字' % len(kb))
    # 🔴 课本表必须覆盖住那 1128 个字，否则「课本为权威」就是句空话。
    #    这里硬闸门：读到的字少于 1100 就直接报错退出，不许悄悄降级成语料众数。
    if len(kb) < 1100:
        print('🔴 课本生字表只读到 %d 个字（应 ≥1100）——正则跟数据格式对不上了，'
              '不许拿语料众数冒充课本读音。先修这个再往下走。' % len(kb))
        return 1

    char_py = {}
    for ch, cnt in dist.items():
        if ch in kb and kb[ch]:
            char_py[ch] = kb[ch]           # 课本权威
        elif ch in MANUAL_DEFAULT:
            char_py[ch] = MANUAL_DEFAULT[ch]
        else:
            char_py[ch] = cnt.most_common(1)[0][0]
    # 人工定音还要能盖过课本（着/片/系 这些课本表里没有，但万一有也别打架）
    for ch, v in MANUAL_DEFAULT.items():
        char_py[ch] = v

    # ── 只保留「默认读音在该片段里是错的」那些片段 ──
    #
    # 🔴 这一步有个**必须堵住的坑**：pypinyin 遇到它不认识的词组，会悄悄退回它自己的
    #    单字读音。拿那种「猜的」结果去覆盖，等于用 pypinyin 的单字表盖掉课本读音。
    #    实测血案：「数一数」pypinyin 给 shù yī shù（按「数学」的 shù 猜的），课本教的是 shǔ。
    #
    #    怎么判断它「到底认没认出这个词」？不能看结果跟它的单字默认像不像——
    #    「重要 zhòng」「数学 shù」「各种 zhǒng」的结果恰好都等于它的单字默认，
    #    但它们是真·词典词，照那个判据会被当成瞎猜丢掉（这三条就真的丢过一次）。
    #    所以直接问它的词典：pypinyin 自带 47111 条的 phrases_dict，
    #    **字被词典里的某个词覆盖住了** = 这个音有出处；没覆盖 = 它就是在猜。
    def dict_hits(seg):
        """贪心最长匹配，标出 seg 里哪些位置被词典词覆盖住了。"""
        mask = [False] * len(seg)
        i = 0
        while i < len(seg):
            for L in range(min(6, len(seg) - i), 1, -1):
                if seg[i:i + L] in PHRASES_DICT:   # 键是字符串（'重要'），不是字符元组
                    for j in range(i, i + L):
                        mask[j] = True
                    i += L
                    break
            else:
                i += 1
        return mask

    def manual_pick(seg, i):
        """MANUAL_SEG 里盖住第 i 字的、最长的键的读音（键可以起于 i 之前）。没有就 None。"""
        best = None
        for st in range(max(0, i - 5), i + 1):
            for L in range(min(6, len(seg) - st), 1, -1):
                if st <= i < st + L and seg[st:st + L] in MANUAL_SEG:
                    v = MANUAL_SEG[seg[st:st + L]].split(' ')
                    if len(v) == L and (best is None or L > best[0]):
                        best = (L, v[i - st])
        return best[1] if best else None

    overrides, guessed, guesses = {}, 0, []
    for s, py in seg_py.items():
        if s in MANUAL_SEG:
            continue                        # 人工表最后统一灌，优先级最高
        if len(s) < 2:
            continue                        # 单字没有上下文，走 PY_CHAR
        mask = dict_hits(s)
        merged, changed = [], False
        for i, (ch, p, ok) in enumerate(zip(s, py, mask)):
            # 🔴 人工键盖住的位置必须用人工读音——整段键比它长，运行时永远选最长的那个，
            #    所以长键一旦在这儿用 char_py 兜底，就会**反过来盖掉**人工写对的词。
            #    实测血案：「位数多的那个大」整段成了键、里面有 shǔ，把人工的「位数 wèi shù」
            #    盖死了，孩子点「位数」的数会听到 shǔ（上线后看数据才发现的）。
            mpy = manual_pick(s, i) if ch not in LOCKED else None
            if mpy is not None:
                merged.append(mpy)
            elif ch in LOCKED:
                merged.append(char_py[ch])          # 一/不 的变调是说话规律，课本只标本调
            elif ok and ch in char_py and p != char_py[ch]:
                merged.append(p); changed = True    # 词典撑腰的词组音，覆盖
            else:
                if not ok and ch in char_py and p != char_py[ch]:
                    guesses.append((s, i, ch, p, char_py[ch]))   # 词典没覆盖却在改音 → 要人看
                merged.append(char_py.get(ch, p))
        if changed:
            overrides[s] = ' '.join(merged)
        else:
            guessed += 1
    print('需要按片段覆盖的：%d 个（%d 个片段不动）' % (len(overrides), guessed))
    # 🔴 不能再判 `if s in segs`：这里的键是**词**（个数/弹珠/教室），
    #    运行时是在长句里做最长匹配找它们的，词本身不一定作为独立片段出现。
    #    上一版就是因为这个门槛，把「个数」这类键全漏掉了（测试抓到的）。
    #    键永不出现也无害——只是多一条查不到的死条目。
    for s, v in MANUAL_SEG.items():
        overrides[s] = v

    # ── 闸门：把「我逐条看过、判定默认读音在这个上下文里也对」锁成快照 ──
    #
    # 上面这 151 处里，一部分 pypinyin 是对的（已写进 MANUAL_SEG），
    # 剩下的就是「默认对、pypinyin 在猜错」。那些**凭什么说默认对，得有人看过**。
    # 这里把「看过的结论」存成一份清单；以后改了 App 的文案、冒出一处没人复核过的
    # 多音字用法，构建就会红，逼着再去看一眼——而不是悄悄用一个可能是错的读音。
    def manual_cover(seg, i):
        """MANUAL_SEG 里有没有哪个键盖住了 seg 的第 i 个字（键可以起于 i 之前）。"""
        for st in range(max(0, i - 5), i + 1):
            for L in range(min(6, len(seg) - st), 1, -1):
                if st <= i < st + L and seg[st:st + L] in MANUAL_SEG:
                    return True
        return False

    resid = sorted('%s\t%s\t%d' % (s, ch, i) for s, i, ch, p, d in guesses if not manual_cover(s, i))

    # 多音字名单的真实含义是「读音要看上下文的字」，所以得并上片段表里改过音的那些。
    #   光看语料分布会漏：行（一行→háng）和筝（风筝→zheng）在语料里只出现过一种读音，
    #   是我们人工按词改的，照样得进名单——不然「名单」就是假的（测试抓到的）。
    amb_set = set(c for c in dist if len(dist[c]) > 1)
    for k, v in overrides.items():
        py = v.split(' ')
        for i, ch in enumerate(k):
            if ch in char_py and py[i] != char_py[ch]:
                amb_set.add(ch)
    amb = sorted(amb_set)
    print('多音字（运行时要去片段表里找）：%d 个' % len(amb))

    # ── 出账：给人工复核看 ──
    rep = io.open('/tmp/pinyin_report.txt', 'w', encoding='utf-8')
    rep.write('【默认读音】多音字 %d 个\n' % len(amb))
    for c in amb:
        rep.write('  %s → %s   （语料里还出现过：%s）\n' % (
            c, char_py[c], '  '.join('%s×%d' % (k, v) for k, v in dist[c].most_common() if k != char_py[c])))
    rep.write('\n🔴【词典没覆盖却在改音】%d 处 —— 逐条看，对了就进 MANUAL_SEG\n' % len(guesses))
    for s_, _i, ch, p_, d_ in sorted(set(guesses), key=lambda x: -segs[x[0]]):
        rep.write('  %-18s 里的「%s」 判=%s  我们的默认=%s\n' % (s_, ch, p_, d_))
    rep.write('\n【残留：多音字走了默认读音】%d 处 —— 闸门快照就是这一节\n' % len(resid))
    for s_, i_, ch_, p_, d_ in sorted(set(guesses), key=lambda x: -segs[x[0]]):
        if not manual_cover(s_, i_):
            rep.write('  %-18s 第%d字「%s」  默认=%s  pypinyin判=%s\n' % (s_, i_, ch_, d_, p_))
    # ── 复核面：多音字「回落到默认读音」的全部上下文 ──────────────────
    #
    # 🔴 为什么还要这一节：上面那个闸门只管「pypinyin 跟我们的默认打架」的位置。
    #    两边**一致地错**时它一声不吭。点字注音上线后看第一张截图就抓到一个：
    #    「每行 9 颗糖果」的行该读 háng，可单字默认是 xíng、pypinyin 也判 xíng，
    #    于是它安安静静地给孩子教了个错音。
    #    所以还得把「多音字走默认读音」的每个上下文都摊到报告里，按字分组看。
    def runtime_pick(seg, i):
        """跟 05_app.js 的 pyFindIn 同一套语义：盖住第 i 字的、最长的片段键优先。"""
        top = max([len(k) for k in overrides] + [2])
        for L in range(min(top, len(seg)), 1, -1):
            for st in range(max(0, i - L + 1), i + 1):
                if st <= i < st + L:
                    k = seg[st:st + L]
                    if k in overrides and len(overrides[k].split(' ')) == len(k):
                        return overrides[k].split(' ')[i - st]
        return char_py.get(seg[i], '')

    fell = collections.defaultdict(collections.Counter)
    for s_, n_ in segs.items():
        for i_, ch_ in enumerate(s_):
            if ch_ not in amb_set:
                continue
            pick = runtime_pick(s_, i_)
            if pick != char_py.get(ch_):
                continue                     # 命中了片段表（已在别的闸门里）
            fell[ch_][s_[max(0, i_ - 3):i_] + '【' + ch_ + '】' + s_[i_ + 1:i_ + 4]] += n_
    n_pairs = sum(len(c) for c in fell.values())
    rep.write('\n【多音字走了默认读音】%d 个字 / %d 种上下文 —— 按字看，这是「两边一致地错」'
              '唯一看得见的地方\n' % (len(fell), n_pairs))
    for ch_ in sorted(fell, key=lambda c: -sum(fell[c].values())):
        rep.write('  %s → 默认 %s（共 %d 处）\n' % (
            ch_, char_py.get(ch_, '?'), sum(fell[ch_].values())))
        for ctx_, cnt_ in fell[ch_].most_common():
            rep.write('       %-20s ×%d\n' % (ctx_, cnt_))

    rep.write('\n【片段覆盖】%d 条\n' % len(overrides))
    for s in sorted(overrides, key=lambda x: -segs[x]):
        rep.write('  %-16s → %-24s  ×%d\n' % (s, overrides[s], segs[s]))
    rep.close()

    # ── 闸门收口：快照对不上就不出片 ──
    # 放在出账之后，是为了让报告先落盘——红了也还能看到「到底是哪几处」。
    frozen = []
    if os.path.exists(REVIEW):
        frozen = [l for l in io.open(REVIEW, encoding='utf-8').read().split('\n') if l.strip()]
    if '--update-review' in sys.argv:
        io.open(REVIEW, 'w', encoding='utf-8').write('\n'.join(resid) + '\n')
        print('已把 %d 条「默认读音判定为对」的结论写进 %s'
              % (len(resid), os.path.relpath(REVIEW, ROOT)))
        print('   ⚠️ 这个参数只有**人逐条看过 /tmp/pinyin_report.txt 的残留那一节**才能跑。')
    elif resid != frozen:
        new = [x for x in resid if x not in frozen]
        gone = [x for x in frozen if x not in resid]
        print('🔴 「多音字走了默认读音」的位置跟复核快照对不上了（新增 %d，消失 %d）：'
              % (len(new), len(gone)))
        for x in new[:20]:
            print('   ＋ %s 里的「%s」' % (x.split('\t')[0], x.split('\t')[1]))
        for x in gone[:20]:
            print('   － %s 里的「%s」' % (x.split('\t')[0], x.split('\t')[1]))
        print('   逐条看 /tmp/pinyin_report.txt 的「残留」一节：')
        print('   读音错的 → 写进 MANUAL_SEG；默认确实对的 → 看过之后跑 --update-review。')
        return 1
    else:
        print('多音字默认读音：%d 处，与复核快照一致 ✅' % len(resid))

    # ── 第二道闸门：「多音字走默认读音」的上下文快照 ──
    # 第一道闸门看不见「两边一致地错」；这道闸门看得见，代价是改了文案多半会红。
    # 红了就照着报告那一节逐字看：读音错的 → 写 MANUAL_DEFAULT / MANUAL_SEG；
    # 默认确实对的 → 看过之后跑 --update-review 重新冻结。
    fall_pairs = sorted('%s\t%s' % (c, x) for c in fell for x in fell[c])
    frozen2 = []
    if os.path.exists(REVIEW2):
        frozen2 = [l for l in io.open(REVIEW2, encoding='utf-8').read().split('\n') if l.strip()]
    if '--update-review' in sys.argv:
        io.open(REVIEW2, 'w', encoding='utf-8').write('\n'.join(fall_pairs) + '\n')
        print('已把 %d 条「多音字默认读音上下文」的复核结论写进 %s'
              % (len(fall_pairs), os.path.relpath(REVIEW2, ROOT)))
        print('   ⚠️ 同上：只有**人逐字看过报告里那一节**才能跑。')
    elif frozen2 != fall_pairs:
        new2 = [x for x in fall_pairs if x not in frozen2]
        gone2 = [x for x in frozen2 if x not in fall_pairs]
        print('🔴 「多音字走默认读音」的上下文跟快照对不上了（新增 %d，消失 %d）：'
              % (len(new2), len(gone2)))
        for x in new2[:20]:
            print('   ＋ %s 里的「%s」' % (x.split('\t')[1], x.split('\t')[0]))
        for x in gone2[:20]:
            print('   － %s' % x.split('\t')[1])
        print('   逐字看 /tmp/pinyin_report.txt 的「多音字走了默认读音」一节：')
        print('   读音错的 → 写 MANUAL_DEFAULT / MANUAL_SEG；默认确实对的 → --update-review。')
        return 1
    else:
        print('多音字默认读音的上下文：%d 种，与复核快照一致 ✅' % len(fall_pairs))

    # ── 写 JS ──
    js = []
    js.append('/* 点字注音用的拼音表 —— 由 tools/build_pinyin.py 生成，别手改。')
    js.append('   改拼音请改那个脚本里的 MANUAL_DEFAULT / MANUAL_SEG，再重跑。')
    js.append('   🔴 为什么分两层：单字一个默认读音兜底，多音字靠 PY_SEG 按**词**定音。')
    js.append('      给二年级孩子看的拼音错一个比不做还糟，所以「着/片/系/一/不」这些')
    js.append('      语料众数会带偏的字，都在脚本里逐条人工定过，理由写在脚本注释里。 */')
    js.append('var PY_CHAR = {')
    line = '  '
    for ch in sorted(char_py):
        item = '"%s":"%s",' % (ch, char_py[ch])
        if len(line) + len(item) > 110:
            js.append(line); line = '  '
        line += item
    if line.strip():
        js.append(line)
    js.append('};')
    js.append('var PY_SEG = {')
    line = '  '
    for s in sorted(overrides):
        item = '"%s":"%s",' % (s, overrides[s])
        if len(line) + len(item) > 110:
            js.append(line); line = '  '
        line += item
    if line.strip():
        js.append(line)
    js.append('};')
    js.append('var PY_AMB = "%s";' % ''.join(amb))
    io.open(OUT, 'w', encoding='utf-8').write('\n'.join(js) + '\n')
    print('写出 %s （%.1f KB）' % (OUT, os.path.getsize(OUT) / 1024))
    print('复核报告：/tmp/pinyin_report.txt')
    return 0


if __name__ == '__main__':
    sys.exit(main())
