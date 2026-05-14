-- AlterTable
ALTER TABLE `documentos_agendamento`
  ADD COLUMN `checklist_item_id` INTEGER NULL,
  ADD COLUMN `checklist_item_key` VARCHAR(80) NULL;

-- CreateTable
CREATE TABLE `checklist_agendamento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `agendamento_id` INTEGER NOT NULL,
    `chave` VARCHAR(80) NOT NULL,
    `nome` VARCHAR(255) NOT NULL,
    `status` ENUM('pendente', 'recebido', 'nao_aplica') NOT NULL DEFAULT 'pendente',
    `ordem` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `checklist_agendamento_agendamento_id_fkey`(`agendamento_id`),
    UNIQUE INDEX `unique_checklist_agendamento_chave`(`agendamento_id`, `chave`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `links_envio_agendamento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `agendamento_id` INTEGER NOT NULL,
    `token` VARCHAR(64) NOT NULL,
    `expires_at` DATETIME(0) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `links_envio_agendamento_agendamento_id_key`(`agendamento_id`),
    UNIQUE INDEX `links_envio_agendamento_token_key`(`token`),
    INDEX `idx_links_envio_agendamento_token`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `documentos_agendamento_checklist_item_id_fkey` ON `documentos_agendamento`(`checklist_item_id`);

-- AddForeignKey
ALTER TABLE `checklist_agendamento` ADD CONSTRAINT `checklist_agendamento_agendamento_id_fkey` FOREIGN KEY (`agendamento_id`) REFERENCES `agendamentos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos_agendamento` ADD CONSTRAINT `documentos_agendamento_checklist_item_id_fkey` FOREIGN KEY (`checklist_item_id`) REFERENCES `checklist_agendamento`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `links_envio_agendamento` ADD CONSTRAINT `links_envio_agendamento_agendamento_id_fkey` FOREIGN KEY (`agendamento_id`) REFERENCES `agendamentos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
