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
			'label'   => '注目の実績（トップに表示）',
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
