-- CreateTable
CREATE TABLE `usuarios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `senha` VARCHAR(255) NOT NULL,
    `role` ENUM('admin', 'contador', 'assistente') NOT NULL DEFAULT 'contador',
    `avatar` VARCHAR(500) NULL,
    `telefone` VARCHAR(20) NULL,
    `cargo` VARCHAR(100) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `usuarios_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contribuintes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cpf` VARCHAR(14) NOT NULL,
    `nome` VARCHAR(255) NOT NULL,
    `data_nascimento` DATE NULL,
    `titulo_eleitor` VARCHAR(20) NULL,
    `endereco_cep` VARCHAR(10) NULL,
    `endereco_uf` VARCHAR(2) NULL,
    `endereco_municipio` VARCHAR(100) NULL,
    `endereco_bairro` VARCHAR(100) NULL,
    `endereco_logradouro` VARCHAR(255) NULL,
    `endereco_numero` VARCHAR(20) NULL,
    `endereco_complemento` VARCHAR(100) NULL,
    `telefone` VARCHAR(20) NULL,
    `email` VARCHAR(255) NULL,
    `ocupacao_principal` VARCHAR(100) NULL,
    `natureza_ocupacao` VARCHAR(100) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `contribuintes_cpf_key`(`cpf`),
    INDEX `idx_contribuintes_cpf`(`cpf`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `declaracoes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contribuinte_id` INTEGER NOT NULL,
    `ano_exercicio` INTEGER NOT NULL,
    `ano_calendario` INTEGER NOT NULL,
    `tipo_declaracao` ENUM('original', 'retificadora') NOT NULL DEFAULT 'original',
    `modelo` ENUM('completo', 'simplificado') NOT NULL DEFAULT 'completo',
    `situacao` ENUM('em_preenchimento', 'transmitida', 'processada', 'pendente', 'malha') NOT NULL DEFAULT 'em_preenchimento',
    `total_rendimentos_tributaveis` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_rendimentos_isentos` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_rendimentos_exclusivos` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_deducoes` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `base_calculo` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `imposto_devido` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `imposto_pago` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `imposto_restituir` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `imposto_pagar` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_bens` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_dividas` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `numero_recibo` VARCHAR(50) NULL,
    `hash_declaracao` VARCHAR(100) NULL,
    `data_transmissao` DATETIME(0) NULL,
    `xml_original` LONGTEXT NULL,
    `dados_json` LONGTEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_declaracoes_ano`(`ano_exercicio`),
    INDEX `idx_declaracoes_contribuinte`(`contribuinte_id`),
    UNIQUE INDEX `unique_declaracao`(`contribuinte_id`, `ano_exercicio`, `tipo_declaracao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rendimentos_tributaveis` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `declaracao_id` INTEGER NOT NULL,
    `tipo` VARCHAR(100) NULL,
    `cnpj_fonte` VARCHAR(18) NULL,
    `nome_fonte` VARCHAR(255) NULL,
    `valor_rendimento` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `valor_previdencia` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `valor_irrf` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `valor_13o` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `irrf_13o` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rendimentos_isentos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `declaracao_id` INTEGER NOT NULL,
    `tipo` VARCHAR(100) NULL,
    `codigo` INTEGER NULL,
    `descricao` VARCHAR(255) NULL,
    `cnpj_fonte` VARCHAR(18) NULL,
    `nome_fonte` VARCHAR(255) NULL,
    `valor` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deducoes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `declaracao_id` INTEGER NOT NULL,
    `tipo` VARCHAR(100) NULL,
    `codigo` INTEGER NULL,
    `descricao` VARCHAR(255) NULL,
    `cpf_cnpj_beneficiario` VARCHAR(18) NULL,
    `nome_beneficiario` VARCHAR(255) NULL,
    `valor` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `valor_reembolso` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `valor_dedutivel` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bens_direitos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `declaracao_id` INTEGER NOT NULL,
    `grupo` INTEGER NULL,
    `codigo` INTEGER NULL,
    `descricao` TEXT NULL,
    `localizacao` VARCHAR(10) NULL,
    `valor_anterior` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `valor_atual` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dividas_onus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `declaracao_id` INTEGER NOT NULL,
    `codigo` INTEGER NULL,
    `descricao` TEXT NULL,
    `cnpj_credor` VARCHAR(18) NULL,
    `nome_credor` VARCHAR(255) NULL,
    `valor_anterior` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `valor_atual` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `valor_pago` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dependentes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `declaracao_id` INTEGER NOT NULL,
    `tipo` INTEGER NULL,
    `cpf` VARCHAR(14) NULL,
    `nome` VARCHAR(255) NULL,
    `data_nascimento` DATE NULL,
    `relacao` VARCHAR(100) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agendamentos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contribuinte_id` INTEGER NULL,
    `usuario_id` INTEGER NULL,
    `titulo` VARCHAR(255) NOT NULL,
    `descricao` TEXT NULL,
    `data_agendamento` DATE NOT NULL,
    `hora_inicio` TIME(0) NULL,
    `hora_fim` TIME(0) NULL,
    `tipo` ENUM('declaracao', 'consultoria', 'revisao', 'entrega_documentos', 'outro') NOT NULL DEFAULT 'declaracao',
    `status` ENUM('agendado', 'confirmado', 'em_andamento', 'concluido', 'cancelado') NOT NULL DEFAULT 'agendado',
    `observacoes` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_agendamentos_data`(`data_agendamento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documentos_agendamento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `agendamento_id` INTEGER NOT NULL,
    `nome_arquivo` VARCHAR(255) NOT NULL,
    `tipo_arquivo` VARCHAR(100) NULL,
    `tamanho_bytes` INTEGER NULL,
    `caminho_arquivo` VARCHAR(500) NULL,
    `url_arquivo` VARCHAR(500) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alertas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contribuinte_id` INTEGER NULL,
    `declaracao_id` INTEGER NULL,
    `tipo` ENUM('prazo', 'pendencia', 'malha', 'documento', 'outro') NOT NULL DEFAULT 'outro',
    `prioridade` ENUM('baixa', 'media', 'alta', 'urgente') NOT NULL DEFAULT 'media',
    `titulo` VARCHAR(255) NOT NULL,
    `mensagem` TEXT NULL,
    `lido` BOOLEAN NOT NULL DEFAULT false,
    `resolvido` BOOLEAN NOT NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_alertas_contribuinte`(`contribuinte_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `log_atividades` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NULL,
    `acao` VARCHAR(100) NOT NULL,
    `entidade` VARCHAR(100) NULL,
    `entidade_id` INTEGER NULL,
    `detalhes` TEXT NULL,
    `ip_address` VARCHAR(45) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `declaracoes` ADD CONSTRAINT `declaracoes_contribuinte_id_fkey` FOREIGN KEY (`contribuinte_id`) REFERENCES `contribuintes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rendimentos_tributaveis` ADD CONSTRAINT `rendimentos_tributaveis_declaracao_id_fkey` FOREIGN KEY (`declaracao_id`) REFERENCES `declaracoes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rendimentos_isentos` ADD CONSTRAINT `rendimentos_isentos_declaracao_id_fkey` FOREIGN KEY (`declaracao_id`) REFERENCES `declaracoes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deducoes` ADD CONSTRAINT `deducoes_declaracao_id_fkey` FOREIGN KEY (`declaracao_id`) REFERENCES `declaracoes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bens_direitos` ADD CONSTRAINT `bens_direitos_declaracao_id_fkey` FOREIGN KEY (`declaracao_id`) REFERENCES `declaracoes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dividas_onus` ADD CONSTRAINT `dividas_onus_declaracao_id_fkey` FOREIGN KEY (`declaracao_id`) REFERENCES `declaracoes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dependentes` ADD CONSTRAINT `dependentes_declaracao_id_fkey` FOREIGN KEY (`declaracao_id`) REFERENCES `declaracoes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_contribuinte_id_fkey` FOREIGN KEY (`contribuinte_id`) REFERENCES `contribuintes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos_agendamento` ADD CONSTRAINT `documentos_agendamento_agendamento_id_fkey` FOREIGN KEY (`agendamento_id`) REFERENCES `agendamentos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alertas` ADD CONSTRAINT `alertas_contribuinte_id_fkey` FOREIGN KEY (`contribuinte_id`) REFERENCES `contribuintes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alertas` ADD CONSTRAINT `alertas_declaracao_id_fkey` FOREIGN KEY (`declaracao_id`) REFERENCES `declaracoes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `log_atividades` ADD CONSTRAINT `log_atividades_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
