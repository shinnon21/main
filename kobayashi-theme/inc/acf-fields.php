<?php
/**
 * ACFフィールドグループのコード登録（設計書 §6.3／導入手順 §4）
 *
 * ACF有効化時に「実績情報」「資料情報」を自動登録する。
 * 管理画面での手作業が不要になり、本番環境でも同一定義が再現される。
 * gallery / repeater は ACF Pro 限定のため、Pro 検出時のみ追加。
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

add_action( 'acf/init', function () {
	if ( ! function_exists( 'acf_add_local_field_group' ) ) { return; }

	/* ---------- 実績情報（投稿タイプ: works） ---------- */
	$works_fields = array(
		array(
			'key'   => 'field_kb_client_name',
			'name'  => 'client_name',
			'label' => 'クライアント名',
			'type'  => 'text',
			'instructions' => '非公開案件は「非公開（業界名）」の形式で記載',
		),
		array(
			'key'         => 'field_kb_period_start',
			'name'        => 'period_start',
			'label'       => '期間（開始）',
			'type'        => 'text',
			'placeholder' => '2025.09',
			'wrapper'     => array( 'width' => '50' ),
		),
		array(
			'key'         => 'field_kb_period_end',
			'name'        => 'period_end',
			'label'       => '期間（終了）',
			'type'        => 'text',
			'placeholder' => '空欄で「現在」表示',
			'wrapper'     => array( 'width' => '50' ),
		),
		array(
			'key'   => 'field_kb_role',
			'name'  => 'role',
			'label' => '役割',
			'type'  => 'text',
		),
		array(
			'key'     => 'field_kb_scope',
			'name'    => 'scope',
			'label'   => '担当領域',
			'type'    => 'checkbox',
			'choices' => array(
				'戦略立案'             => '戦略立案',
				'要件定義'             => '要件定義',
				'設計'                 => '設計',
				'デザイン'             => 'デザイン',
				'実装'                 => '実装',
				'運用'                 => '運用',
				'データ分析'           => 'データ分析',
				'リサーチ・調査'       => 'リサーチ・調査',
				'マーケティング・広報' => 'マーケティング・広報',
				'コミュニティ運営'     => 'コミュニティ運営',
				'講師・登壇'           => '講師・登壇',
			),
		),
		array(
			'key'   => 'field_kb_tech_stack',
			'name'  => 'tech_stack',
			'label' => '使用技術・ツール',
			'type'  => 'text',
		),
		array(
			'key'   => 'field_kb_site_url',
			'name'  => 'site_url',
			'label' => 'サイトURL',
			'type'  => 'url',
		),
		array(
			'key'     => 'field_kb_is_featured',
			'name'    => 'is_featured',
			'label'   => '主な実績としてトップに表示',
			'type'    => 'true_false',
			'ui'      => 1,
		),
	);

	/* ACF Pro 限定フィールド（無印ACFでは本文への画像挿入で代替） */
	if ( class_exists( 'acf_pro' ) || defined( 'ACF_PRO' ) ) {
		$works_fields[] = array(
			'key'   => 'field_kb_gallery',
			'name'  => 'gallery',
			'label' => 'ギャラリー',
			'type'  => 'gallery',
		);
		$works_fields[] = array(
			'key'        => 'field_kb_kpi_results',
			'name'       => 'kpi_results',
			'label'      => 'KPI・成果',
			'type'       => 'repeater',
			'layout'     => 'table',
			'sub_fields' => array(
				array(
					'key'   => 'field_kb_kpi_label',
					'name'  => 'label',
					'label' => '項目',
					'type'  => 'text',
				),
				array(
					'key'   => 'field_kb_kpi_value',
					'name'  => 'value',
					'label' => '数値・結果',
					'type'  => 'text',
				),
			),
		);
	}

	acf_add_local_field_group( array(
		'key'      => 'group_kb_works_info',
		'title'    => '実績情報',
		'fields'   => $works_fields,
		'location' => array(
			array(
				array(
					'param'    => 'post_type',
					'operator' => '==',
					'value'    => 'works',
				),
			),
		),
		'position' => 'normal',
	) );

	/* ---------- プロフィール編集（page-profile.phpテンプレートのページ） ----------
	   無印ACFで動くよう「1行1項目＋パイプ区切り」のテキスト欄で構成。
	   default_value は現在の掲載内容（functions.php の kb_profile_defaults）。
	   未保存でもテンプレート側が同じ初期値にフォールバックする */
	$pd  = function_exists( 'kb_profile_defaults' ) ? kb_profile_defaults() : array();
	$pdv = function ( $k ) use ( $pd ) { return isset( $pd[ $k ] ) ? $pd[ $k ] : ''; };
	/* 場所ルール: テンプレート一致に加え、スラッグ profile のページIDでも一致させる。
	   （テンプレート欄が「デフォルト」のままでもスラッグ階層で page-profile.php が
	   適用されて表示は正常なため、編集画面にだけ欄が出ない事故が起きる） */
	$kb_profile_location = array(
		array( array( 'param' => 'page_template', 'operator' => '==', 'value' => 'page-profile.php' ) ),
	);
	$kb_profile_page = get_page_by_path( 'profile' );
	if ( $kb_profile_page ) {
		$kb_profile_location[] = array( array( 'param' => 'page', 'operator' => '==', 'value' => $kb_profile_page->ID ) );
	}
	acf_add_local_field_group( array(
		'key'      => 'group_kb_profile',
		'title'    => 'プロフィール編集',
		'fields'   => array(
			array(
				'key'           => 'field_kb_pf_kana',
				'name'          => 'profile_kana',
				'label'         => 'ふりがな',
				'type'          => 'text',
				'default_value' => $pdv( 'profile_kana' ),
				'wrapper'       => array( 'width' => '34' ),
			),
			array(
				'key'           => 'field_kb_pf_name',
				'name'          => 'profile_name',
				'label'         => '名前',
				'type'          => 'text',
				'default_value' => $pdv( 'profile_name' ),
				'wrapper'       => array( 'width' => '66' ),
			),
			array(
				'key'           => 'field_kb_pf_role',
				'name'          => 'profile_role',
				'label'         => '肩書き',
				'type'          => 'text',
				'default_value' => $pdv( 'profile_role' ),
			),
			array(
				'key'           => 'field_kb_pf_bio',
				'name'          => 'profile_bio',
				'label'         => '自己紹介文',
				'type'          => 'textarea',
				'rows'          => 5,
				'default_value' => $pdv( 'profile_bio' ),
			),
			array(
				'key'           => 'field_kb_pf_career',
				'name'          => 'profile_career',
				'label'         => '経歴（1行につき1項目・新しい順）',
				'type'          => 'textarea',
				'rows'          => 9,
				'instructions'  => '書式: 期間 | タイトル | 説明　（説明は省略可。「|」で区切る）',
				'default_value' => $pdv( 'profile_career' ),
			),
			array(
				'key'           => 'field_kb_pf_skills',
				'name'          => 'profile_skills',
				'label'         => 'スキル・強み（1行につき1グループ）',
				'type'          => 'textarea',
				'rows'          => 5,
				'instructions'  => '書式: グループ名 | スキル、スキル、スキル　（スキルは読点「、」区切り）',
				'default_value' => $pdv( 'profile_skills' ),
			),
			array(
				'key'           => 'field_kb_pf_research_title',
				'name'          => 'profile_research_title',
				'label'         => '研究テーマ（タイトル）',
				'type'          => 'text',
				'default_value' => $pdv( 'profile_research_title' ),
			),
			array(
				'key'           => 'field_kb_pf_research_body',
				'name'          => 'profile_research_body',
				'label'         => '研究テーマ（説明）',
				'type'          => 'textarea',
				'rows'          => 4,
				'default_value' => $pdv( 'profile_research_body' ),
			),
			array(
				'key'           => 'field_kb_pf_activities',
				'name'          => 'profile_activities',
				'label'         => '登壇・対外活動（1行につき1項目）',
				'type'          => 'textarea',
				'rows'          => 4,
				'default_value' => $pdv( 'profile_activities' ),
			),
		),
		'location' => $kb_profile_location,
		'position' => 'normal',
	) );

	/* ---------- 英語版コンテンツ（実績・コラム・お知らせ・固定ページ） ----------
	   /en/ 表示時に使用。未入力の項目は日本語にフォールバックする */
	acf_add_local_field_group( array(
		'key'      => 'group_kb_en_content',
		'title'    => '英語版コンテンツ（English）',
		'fields'   => array(
			array(
				'key'          => 'field_kb_en_title',
				'name'         => 'title_en',
				'label'        => 'タイトル（英語）',
				'type'         => 'text',
				'instructions' => '空欄なら日本語タイトルを表示',
			),
			array(
				'key'          => 'field_kb_en_excerpt',
				'name'         => 'excerpt_en',
				'label'        => '抜粋（英語）',
				'type'         => 'textarea',
				'rows'         => 3,
				'instructions' => 'カード・リード文・meta descriptionに使用。空欄なら日本語抜粋',
			),
			array(
				'key'          => 'field_kb_en_content',
				'name'         => 'content_en',
				'label'        => '本文（英語）',
				'type'         => 'wysiwyg',
				'media_upload' => 0,
				'instructions' => '空欄なら日本語本文を表示',
			),
		),
		'location' => array(
			array( array( 'param' => 'post_type', 'operator' => '==', 'value' => 'works' ) ),
			array( array( 'param' => 'post_type', 'operator' => '==', 'value' => 'column' ) ),
			array( array( 'param' => 'post_type', 'operator' => '==', 'value' => 'news' ) ),
			array( array( 'param' => 'post_type', 'operator' => '==', 'value' => 'page' ) ),
		),
		'position' => 'normal',
	) );

	/* ---------- 資料情報（投稿タイプ: document） ---------- */
	acf_add_local_field_group( array(
		'key'      => 'group_kb_document_info',
		'title'    => '資料情報',
		'fields'   => array(
			array(
				'key'           => 'field_kb_doc_file',
				'name'          => 'file',
				'label'         => '資料ファイル（PDF）',
				'type'          => 'file',
				'return_format' => 'url',
				'mime_types'    => 'pdf',
			),
		),
		'location' => array(
			array(
				array(
					'param'    => 'post_type',
					'operator' => '==',
					'value'    => 'document',
				),
			),
		),
		'position' => 'normal',
	) );
} );
