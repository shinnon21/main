<?php
/**
 * Template Name: プロフィール
 * 設計書 §5.8。経歴・スキル等は初期データを直書き（後で管理画面編集に移行可）
 */
get_header();
get_template_part( 'parts/page-hero', null, array( 'label' => 'profile', 'title' => 'プロフィール' ) );
?>
<div class="sec">
	<div class="container" style="max-width:900px">

		<div class="prof" style="margin-bottom:32px">
			<?php kb_avatar(); ?>
			<div>
				<p class="kana">こばやし しんのすけ</p>
				<h2>小林 慎之助</h2>
				<p class="role">Weeave株式会社 共同創業者・代表取締役 CEO ／ 筑波大学 理工学群 社会工学類 経営工学主専攻</p>
				<p>筑波大学で経営工学を学びながら、政治・行政・企業のDXと社会課題の解決に取り組む学生起業家。データドリブンな戦略立案と、人と人をつなぐコミュニティ構築を強みに、「構想で終わらせず、現場で使われる仕組みとして社会に実装する」ことに一貫してこだわっています。長期的には「日本の技術を社会に届けるコーディネーター」として、ディープテックの社会実装をビジネス・資本構造の側から支えることを目指しています。</p>
				<?php kb_sns_links(); ?>
			</div>
		</div>

		<?php /* 固定ページ本文（管理画面から追記可能） */
		while ( have_posts() ) : the_post();
			if ( trim( get_the_content() ) ) : ?>
		<div class="profile-sec"><div class="entry-content"><?php the_content(); ?></div></div>
		<?php endif; endwhile; ?>

		<div class="profile-sec">
			<h2><span class="lbl">career</span>経歴</h2>
			<div class="timeline">
				<div class="tl-item">
					<div class="d">2025.09 –</div>
					<div class="t">Weeave株式会社 共同創業・代表取締役 CEO</div>
					<p>政治・行政・企業のDXを推進する筑波大学認定スタートアップを共同創業。政治DX・広報戦略支援、地域ニーズの可視化、システム開発・社会実装の3本柱で事業を展開。</p>
				</div>
				<div class="tl-item">
					<div class="d">2025.01 – 2025.12</div>
					<div class="t">JSIP（Japan Southeast Asia Innovation Platform）Community Accelerator</div>
					<p>シンガポール拠点で日本企業の東南アジア進出を支援。約3ヶ月で100名近い新規事業担当者と接点を構築。</p>
				</div>
				<div class="tl-item">
					<div class="d">2025.04 – 2025.09</div>
					<div class="t">衆議院議員事務所 Digital Transformation Manager</div>
					<p>政治・立法活動のDXを担当。独自の選挙シミュレーションモデルを開発し、データドリブンな戦略立案を支援。</p>
				</div>
				<div class="tl-item">
					<div class="d">2024.11 – 2025.06</div>
					<div class="t">RULEMAKERS DAO Team Manager</div>
					<p>「RIFT」ブランド確立のためのマルチチャネル・マーケティング戦略を立案・実行。</p>
				</div>
				<div class="tl-item">
					<div class="d">2024.04 – 2025.03</div>
					<div class="t">AIESEC Business Development Manager</div>
					<p>渉外統括として企業パートナーとの関係構築、ディープテック×学生のイベント企画を推進。</p>
				</div>
				<div class="tl-item">
					<div class="d">2024.01 – 2024.12</div>
					<div class="t">株式会社Geears Growth Marketing Intern</div>
					<p>大学1年次に直談判で参画。政治ブランディング等の戦略立案を主導し、のちのWeeave共同創業の起点に。</p>
				</div>
				<div class="tl-item">
					<div class="d">2023.04 –</div>
					<div class="t">筑波大学 理工学群 社会工学類 入学（経営工学主専攻）</div>
					<p>2027年3月卒業見込み。2027年4月より同大学院サービス工学学位プログラムに進学予定（有馬澄佳研究室）。</p>
				</div>
			</div>
		</div>

		<div class="profile-sec">
			<h2><span class="lbl">skills</span>スキル・強み</h2>
			<div class="skill-group"><div class="g">事業開発・DX</div><span class="chip"># 事業開発・新規事業創出</span><span class="chip"># DX推進（政治・行政・企業）</span><span class="chip"># クロスボーダー事業開発</span></div>
			<div class="skill-group"><div class="g">データ・分析</div><span class="chip"># データ分析</span><span class="chip"># 選挙シミュレーション</span><span class="chip"># 経営工学／OR</span></div>
			<div class="skill-group"><div class="g">マーケティング・コミュニティ</div><span class="chip"># マーケティング・広報</span><span class="chip"># ブランディング</span><span class="chip"># コミュニティ構築</span><span class="chip"># イベント企画</span></div>
			<div class="skill-group"><div class="g">言語</div><span class="chip"># 日本語（母語）</span><span class="chip"># 英語（ビジネスレベル）</span></div>
		</div>

		<div class="profile-sec" id="research">
			<h2><span class="lbl">research</span>研究テーマ</h2>
			<p style="font-weight:700;margin-bottom:10px">下水サーベイランスを起点とした医薬品サプライチェーンの予兆・予動最適化システム</p>
			<p style="font-size:14px;color:#4a4a4a">下水サーベイランス（WBE）による感染流行の先行予測を医薬品サプライチェーンの在庫・物流の意思決定へ統合し、「事後対応」から「予兆・予動管理」への転換を目指す研究。有馬澄佳研究室にて、オペレーションズ・リサーチと公衆衛生データを架橋する社会実装志向のテーマに取り組んでいます。</p>
		</div>

		<div class="profile-sec">
			<h2><span class="lbl">activity</span>登壇・対外活動</h2>
			<ul style="list-style:disc;margin-left:20px;font-size:15px">
				<li style="margin-bottom:8px">静岡県議会議員向け AI勉強会（主催・講師）— 政治現場での生成AI活用を講義</li>
				<li style="margin-bottom:8px">「戦略的大学生活のススメ vol.49」ピッチ登壇（2025.04／Tsukuba Place Lab）</li>
				<li>JSIP公式メディア インターン体験インタビュー掲載</li>
			</ul>
		</div>

		<div class="contact-cta">
			<p class="lbl">contact</p>
			<h2>お問い合わせ・ご相談</h2>
			<p>採用・案件・協業のご相談はお気軽にご連絡ください。</p>
			<a class="btn white" href="<?php echo esc_url( home_url( '/contact/' ) ); ?>">お問い合わせ →</a>
		</div>

	</div>
</div>
<?php get_footer(); ?>
