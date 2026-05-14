-- CreateTable
CREATE TABLE `configuracao_sistema` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome_empresa` VARCHAR(255) NULL,
    `cnpj_empresa` VARCHAR(20) NULL,
    `email_suporte` VARCHAR(255) NULL,
    `cor_tema` VARCHAR(20) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
