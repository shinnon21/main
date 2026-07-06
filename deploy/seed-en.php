<?php
/**
 * 英語版コンテンツ投入（wp eval-file deploy/seed-en.php で実行）
 *
 * /en/ 表示で使う英語メタ（title_en / excerpt_en / content_en、実績は
 * client_name_en / role_en / tech_stack_en / kpi_results_en も）を
 * 既存投稿に設定する。対象は seed-content.php で投入した実績7件・
 * お知らせ1件と、固定ページ（about / privacy / contact / profile / searches）。
 *
 * 冪等: title_en が既に入っている投稿はスキップ（管理画面での編集を保護）。
 * 実行後は 設定→パーマリンク の再保存（/en/ ルーティング登録）を忘れずに。
 */

if ( ! class_exists( 'WP_CLI' ) ) {
	class WP_CLI {
		public static function log( $m ) { echo $m . "\n"; }
		public static function success( $m ) { echo '✅ ' . $m . "\n"; }
	}
}

/* 日本語タイトルで既存投稿を特定する */
function kb_seed_en_find( $type, $title ) {
	$q = new WP_Query( array( 'post_type' => $type, 'title' => $title, 'posts_per_page' => 1, 'post_status' => 'any', 'no_found_rows' => true ) );
	return $q->have_posts() ? $q->posts[0] : null;
}

function kb_seed_en_apply( $post, $meta, $label ) {
	if ( ! $post ) {
		WP_CLI::log( 'NOT FOUND: ' . $label );
		return;
	}
	if ( trim( (string) get_post_meta( $post->ID, 'title_en', true ) ) !== '' ) {
		WP_CLI::log( 'skip（title_en あり）: ' . $label );
		return;
	}
	foreach ( $meta as $k => $v ) {
		if ( is_string( $v ) ) { $v = trim( $v ); }
		update_post_meta( $post->ID, $k, $v );
	}
	WP_CLI::log( 'EN set: ' . $label );
}

/* ---------- 1. 実績7件 ---------- */
$kb_works_en = array(

	'Weeave株式会社 共同創業・経営' => array(
		'title_en'   => 'Co-founding & Leading Weeave Inc.',
		'excerpt_en' => 'Co-founded a University of Tsukuba-certified startup under the slogan "Weave the Design of Society." — operating on three pillars: political DX and communication strategy, visualization of community needs, and system development for social implementation.',
		'client_name_en' => 'Weeave Inc. (own company)',
		'role_en'        => 'Co-founder & CEO',
		'tech_stack_en'  => 'Social media operations / AI dialogue systems / data analysis infrastructure',
		'content_en' => '
<h2>Overview</h2>
<p>In September 2025 I co-founded Weeave Inc., a University of Tsukuba-certified startup driving social change and digital innovation, and became its Representative Director &amp; CEO. Our mission is to solve complex social challenges with the power of technology and to modernize administrative and political processes. Our slogan is <strong>"Weave the Design of Society."</strong> and our vision is to reconnect a fragmented society and move toward social design that leaves no one behind (Be Inclusive).</p>
<h2>How It Started</h2>
<p>In January 2024, in my first year of university, I reached out to Geears Inc. directly through its website and joined as an intern, working on branding and marketing for politicians. From April 2025 I expanded into DX for a legislator\'s office and for politics at large, and in September of the same year I co-founded Weeave together with the CEO of Geears — who is also a specially appointed (visiting) professor at Tohoku University\'s Language AI Center and serves as a Weeave director. Hands-on experience in political and governmental DX that began as an internship led directly to founding the company.</p>
<h2>Three Pillars of the Business</h2>
<ol>
<li><strong>Political DX &amp; communication strategy</strong> — Using social media and AI dialogue systems to shift from one-way broadcasting to two-way communication; accumulating and visualizing residents\' voices and helping offices build sustainable operations.</li>
<li><strong>Visualization of community needs</strong> — Collecting and analyzing the community\'s unheard voices and statistical data, turning them into objective figures that support evidence-based policy discussion.</li>
<li><strong>System development &amp; social implementation</strong> — Going beyond concepts: building and operating systems end to end so they take root in the community.</li>
</ol>
<h2>Case Studies</h2>
<p>Geears Inc. (data analysis), RULEMAKERS DAO (public relations).</p>',
	),

	'衆議院議員事務所のDX支援・選挙シミュレーションモデル開発' => array(
		'title_en'   => 'DX for a House of Representatives Member\'s Office & an Election Simulation Model',
		'excerpt_en' => 'Led the digital modernization of political and legislative activities at the office of a member of the House of Representatives elected from Aichi, developing an original election simulation model for data-driven strategy.',
		'client_name_en' => 'Office of a Member of the House of Representatives (elected from Aichi)',
		'tech_stack_en'  => 'Original election simulation model / social media / online event platforms',
		'content_en' => '
<h2>Overview</h2>
<p>I was in charge of digitally modernizing political and legislative activities at the office of a member of the House of Representatives elected from Aichi Prefecture.</p>
<h2>Key Work</h2>
<ul>
<li>Led DX initiatives to modernize political activities and election strategy.</li>
<li>Developed an original <strong>election simulation model</strong> enabling data-driven strategy and decision-making.</li>
<li>Planned and executed digital engagement strategies — including social media campaigns and online events — to strengthen voter outreach.</li>
<li>Improved internal operational efficiency by digitizing paperwork and workflows.</li>
</ul>
<h2>Outcomes &amp; What Followed</h2>
<p>The expertise and track record in political and governmental DX gained here led directly to co-founding Weeave Inc. in September 2025.</p>',
	),

	'JSIP — 日本企業の東南アジア新規事業開発支援' => array(
		'title_en'   => 'JSIP — Supporting Japanese Companies\' New Business Development in Southeast Asia',
		'excerpt_en' => 'Supported Japanese companies entering Southeast Asia at JSIP, a Singapore-based co-creation platform — building relationships with nearly 100 new-business managers in about three months.',
		'tech_stack_en'  => 'PR content production / event operations / community management',
		'kpi_results_en' => array(
			array( 'label' => 'New-business contacts built (in about 3 months)', 'value' => '~100 people' ),
		),
		'content_en' => '
<h2>Overview</h2>
<p>JSIP is a strategic co-creation platform that supports Japanese companies\' new business development in Southeast Asia. After seeing the news release about its MOU with Tsukuba City in November 2024, I applied directly — "I want to do this in Singapore" — and joined. I was based in Singapore from January to March 2025 and continued the work from Tokyo after returning.</p>
<h2>Key Work</h2>
<ul>
<li>Led community engagement and partnership development to support Japanese companies entering Southeast Asian markets.</li>
<li>Drove new business creation by uncovering corporate needs and building strategic alliances with local companies and government agencies.</li>
<li><strong>PR</strong> — wrote event announcements and post-event reports, and produced introduction videos for entrepreneur members.</li>
<li><strong>Member meeting support</strong> — sat in on onboarding and catch-up meetings, hearing member companies\' real business challenges and expectations first-hand.</li>
<li>Helped run events such as the "JSIP Lounge".</li>
</ul>
<h2>Outcomes &amp; Lessons</h2>
<p>Built relationships with nearly 100 new-business managers in about three months. Through experiences such as attending "InnoVision" at Marina Bay Sands (300+ participants), I came to a formative realization: business happens between people. This experience crystallized my long-term identity as a coordinator who delivers Japanese technology to society.</p>
<p>Related links: <a href="https://note.com/shinnon21/n/ne4e1b865eeee" target="_blank" rel="noopener">Notes from Singapore (note, in Japanese)</a> / <a href="https://jsip.asia/news/jsip_intern_kobayashi/" target="_blank" rel="noopener">Intern interview</a></p>',
	),

	'RULEMAKERS DAO —「RIFT」ブランドのマーケティング戦略' => array(
		'title_en'   => 'RULEMAKERS DAO — Marketing Strategy for the "RIFT" Brand',
		'excerpt_en' => 'Planned and executed a multi-channel marketing strategy to establish the "RIFT" brand at an organization tackling social challenges through collaborative rulemaking.',
		'client_name_en' => 'RULEMAKERS DAO',
		'tech_stack_en'  => 'Multi-channel marketing / content production',
		'content_en' => '
<h2>Overview</h2>
<p>RULEMAKERS DAO is a forward-looking organization that tackles social challenges through collaborative rulemaking. As Team Manager, I was responsible for marketing its "RIFT" program.</p>
<h2>Key Work</h2>
<ul>
<li>Planned and executed a multi-channel marketing strategy to establish the RIFT brand within the global innovator community.</li>
<li>Communicated RIFT\'s unique value proposition effectively, driving recruitment of program participants (innovators) and strategic partners.</li>
<li>Used data-driven insights to optimize outreach and to target and acquire high-impact rulemakers.</li>
<li>Articulated the program\'s mission — designing new markets and social systems — through persuasive messaging and content.</li>
</ul>',
	),

	'AIESEC — 渉外統括・ディープテック×学生イベントの企画' => array(
		'title_en'   => 'AIESEC — External Relations Lead & Deep-Tech × Student Events',
		'excerpt_en' => 'Led external relations at AIESEC, one of the world\'s largest student-run organizations — planning strategic events that connect students with the deep-tech industry and driving sponsorship targets.',
		'client_name_en' => 'AIESEC (Ibaraki / Tsukuba)',
		'tech_stack_en'  => 'Sponsor relations / event planning / team management',
		'content_en' => '
<h2>Overview</h2>
<p>AIESEC is one of the world\'s largest student-led organizations, offering leadership development opportunities through cross-cultural exchange. I led external relations as Business Development Manager.</p>
<h2>Key Work</h2>
<ul>
<li>Oversaw external relations, building and maintaining relationships with corporate partners and stakeholders.</li>
<li>Planned and designed strategic events that expose students to the deep-tech industry and foster leadership development.</li>
<li>Led cross-functional project teams, achieving sponsorship targets and building frameworks for high-impact events.</li>
</ul>',
	),

	'株式会社Geears — グロースマーケティング・戦略立案' => array(
		'title_en'   => 'Geears Inc. — Growth Marketing & Strategy',
		'excerpt_en' => 'Joined a data-driven consulting firm in my first year of university by reaching out directly. Led strategy work including political branding — the starting point of later co-founding Weeave.',
		'client_name_en' => 'Geears Inc.',
		'tech_stack_en'  => 'Data analysis / marketing strategy',
		'content_en' => '
<h2>Overview</h2>
<p>Geears is a Japanese consulting firm specializing in data-driven marketing and business strategy solutions. In January 2024 — my first year of university — I reached out through its website and joined as an intern, which became the starting point of my career and, later, of co-founding Weeave.</p>
<h2>Key Work</h2>
<ul>
<li>Led strategy work across diverse projects, including political branding, a talent development program for the energy industry, and support for an environmental NPO.</li>
<li>Built and optimized high-performing marketing strategies using data analysis, driving continuous improvement.</li>
<li>Delivered distinctive, innovative client solutions drawing on experience across politics, business, and the environment.</li>
</ul>',
	),

	'静岡県議会議員向け AI勉強会（主催・講師）' => array(
		'title_en'   => 'AI Study Session for Shizuoka Prefectural Assembly Members (Organizer & Lecturer)',
		'excerpt_en' => 'As CEO of Weeave Inc., organized and lectured at an AI study session for members of the Shizuoka Prefectural Assembly, sharing practical uses of generative AI in politics and government.',
		'client_name_en' => 'Members of the Shizuoka Prefectural Assembly',
		'role_en'        => 'Organizer & lecturer (as CEO of Weeave Inc.)',
		'tech_stack_en'  => 'Training on generative AI and digital tools',
		'content_en' => '
<h2>Overview</h2>
<p>As the CEO of Weeave Inc., I organized and lectured at an AI study session for members of the Shizuoka Prefectural Assembly — sharing practical ways to use generative AI and digital tools in politics and government, and promoting political DX.</p>
<h2>Related Talks &amp; Activities</h2>
<ul>
<li>Pitch talk at "Strategic University Life vol.49" (April 17, 2025 / Tsukuba Place Lab) — shared tips for a strategic university life, based on my experience in business development support at JSIP in Singapore and DX for a legislator\'s office.</li>
<li>An interview about my internship experience was published on JSIP\'s official media.</li>
</ul>',
	),
);

foreach ( $kb_works_en as $ja_title => $meta ) {
	kb_seed_en_apply( kb_seed_en_find( 'works', $ja_title ), $meta, 'works: ' . $ja_title );
}

/* ---------- 2. お知らせ ---------- */
kb_seed_en_apply( kb_seed_en_find( 'news', 'ポートフォリオサイトを公開しました' ), array(
	'title_en'   => 'Portfolio website launched',
	'excerpt_en' => 'shinnosuke-kobayashi.jp is now live.',
	'content_en' => '<p>shinnosuke-kobayashi.jp is now live. Works, columns, and news will be updated regularly.</p>',
), 'news: ポートフォリオサイトを公開しました' );

/* ---------- 3. 固定ページ ---------- */
$kb_pages_en = array(

	'profile'  => array( 'title_en' => 'Profile' ),
	'searches' => array( 'title_en' => 'Advanced Search' ),
	'contact'  => array( 'title_en' => 'Contact' ),

	'about' => array(
		'title_en'   => 'About This Site',
		'content_en' => '
<h2>Purpose of This Site</h2>
<p>This website is the personal portfolio of Shinnosuke Kobayashi (Co-founder &amp; CEO of Weeave Inc. / Management Science and Engineering major, College of Policy and Planning Sciences, University of Tsukuba), bringing together his work, research, and writing. Its purpose is to give you the full picture of his activities when considering a work request or collaboration.</p>

<h2>Content Policy</h2>
<ul>
<li>Projects are published only within the scope permitted by clients or already public. Confidential projects are introduced with labels such as "Undisclosed (industry name)".</li>
<li>Figures and results are as of the time of publication and may have changed since.</li>
<li>Content may be added, revised, or removed without notice.</li>
</ul>

<h2>Quotations &amp; Links</h2>
<ul>
<li>You are free to link to this site (no prior notice required).</li>
<li>When quoting text from this site, please credit the source (site name and URL).</li>
<li>Please refrain from reproducing logos, photographs, and other materials without permission.</li>
</ul>

<h2>Site Owner</h2>
<p>Shinnosuke Kobayashi<br>
See the <a href="/en/profile/">profile page</a> for details on career, skills, and research.</p>

<h2>Contact</h2>
<p>For work inquiries, interviews, or speaking requests, please use the <a href="/en/contact/">contact form</a>.</p>',
	),

	'privacy' => array(
		'title_en'   => 'Privacy Policy',
		'content_en' => '
<p>Shinnosuke Kobayashi ("I" or "me") sets out this privacy policy for the handling of personal information on this website, "Shinnosuke Kobayashi Portfolio" (shinnosuke-kobayashi.jp, the "Site").</p>

<h2>1. Collection of Personal Information</h2>
<p>When you use the contact form on this Site, you will be asked to provide your name, company or affiliation, email address, and the content of your inquiry.</p>

<h2>2. Purpose of Use</h2>
<p>Personal information collected is used only for the following purposes:</p>
<ul>
<li>Responding to and following up on inquiries</li>
<li>Coordinating work requests, collaborations, and similar matters</li>
</ul>

<h2>3. Provision to Third Parties</h2>
<p>Personal information will not be provided to third parties without your consent, except where required by law.</p>

<h2>4. Analytics Tools</h2>
<p>This Site may use access analytics tools such as Google Analytics to improve the Site. These tools use cookies to collect traffic data; the data is collected anonymously and does not identify individuals. You can disable cookies in your browser settings.</p>

<h2>5. Security</h2>
<p>This Site encrypts communication via SSL (HTTPS). Personal information collected is managed appropriately, and efforts are made to prevent leakage, loss, or damage.</p>

<h2>6. Disclosure, Correction, and Deletion</h2>
<p>Requests for disclosure, correction, or deletion of your personal information will be handled promptly after identity verification. Please contact me via the <a href="/en/contact/">contact form</a>.</p>

<h2>7. Disclaimer</h2>
<p>I assume no responsibility for the handling of personal information on external sites linked from this Site.</p>

<h2>8. Revisions to This Policy</h2>
<p>This policy may be revised without notice as necessary. The revised policy takes effect when posted on this page.</p>

<p>Established: July 2026</p>',
	),
);

foreach ( $kb_pages_en as $slug => $meta ) {
	kb_seed_en_apply( get_page_by_path( $slug ), $meta, 'page: /' . $slug . '/' );
}

WP_CLI::success( 'seed-en done — 設定→パーマリンクの再保存（/en/ ルーティング登録）を忘れずに' );
