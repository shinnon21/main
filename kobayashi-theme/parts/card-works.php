<?php /* 実績カード（グリッド用） */ ?>
<a class="card" href="<?php the_permalink(); ?>">
	<?php kb_thumb(); ?>
	<div class="body">
		<div class="meta"><?php kb_type_badge(); ?><?php kb_works_period(); ?></div>
		<h3><?php the_title(); ?></h3>
		<?php kb_skill_chips( 3, false ); ?>
	</div>
</a>
