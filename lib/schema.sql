-- ANALIR Database Schema
-- Sistema de Analise de Imposto de Renda

CREATE DATABASE IF NOT EXISTS analir_db;
USE analir_db;

-- Tabela de Usuarios do Sistema
CREATE TABLE IF NOT EXISTS usuarios (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  senha VARCHAR(255) NOT NULL,
  role ENUM('admin', 'contador', 'assistente') DEFAULT 'contador',
  avatar VARCHAR(500),
  telefone VARCHAR(20),
  cargo VARCHAR(100),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela de Contribuintes
CREATE TABLE IF NOT EXISTS contribuintes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  cpf VARCHAR(14) UNIQUE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  data_nascimento DATE,
  titulo_eleitor VARCHAR(20),
  endereco_cep VARCHAR(10),
  endereco_uf VARCHAR(2),
  endereco_municipio VARCHAR(100),
  endereco_bairro VARCHAR(100),
  endereco_logradouro VARCHAR(255),
  endereco_numero VARCHAR(20),
  endereco_complemento VARCHAR(100),
  telefone VARCHAR(20),
  email VARCHAR(255),
  ocupacao_principal VARCHAR(100),
  natureza_ocupacao VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela de Declaracoes IRPF
CREATE TABLE IF NOT EXISTS declaracoes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  contribuinte_id INT NOT NULL,
  ano_exercicio INT NOT NULL,
  ano_calendario INT NOT NULL,
  tipo_declaracao ENUM('original', 'retificadora') DEFAULT 'original',
  modelo ENUM('completo', 'simplificado') DEFAULT 'completo',
  situacao ENUM('em_preenchimento', 'transmitida', 'processada', 'pendente', 'malha') DEFAULT 'em_preenchimento',
  
  -- Resumo Financeiro
  total_rendimentos_tributaveis DECIMAL(15, 2) DEFAULT 0,
  total_rendimentos_isentos DECIMAL(15, 2) DEFAULT 0,
  total_rendimentos_exclusivos DECIMAL(15, 2) DEFAULT 0,
  total_deducoes DECIMAL(15, 2) DEFAULT 0,
  base_calculo DECIMAL(15, 2) DEFAULT 0,
  imposto_devido DECIMAL(15, 2) DEFAULT 0,
  imposto_pago DECIMAL(15, 2) DEFAULT 0,
  imposto_restituir DECIMAL(15, 2) DEFAULT 0,
  imposto_pagar DECIMAL(15, 2) DEFAULT 0,
  
  -- Patrimonio
  total_bens DECIMAL(15, 2) DEFAULT 0,
  total_dividas DECIMAL(15, 2) DEFAULT 0,
  
  -- Metadados XML
  numero_recibo VARCHAR(50),
  hash_declaracao VARCHAR(100),
  data_transmissao DATETIME,
  
  -- Dados brutos do XML
  xml_original LONGTEXT,
  dados_json LONGTEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (contribuinte_id) REFERENCES contribuintes(id) ON DELETE CASCADE,
  UNIQUE KEY unique_declaracao (contribuinte_id, ano_exercicio, tipo_declaracao)
);

-- Tabela de Rendimentos Tributaveis
CREATE TABLE IF NOT EXISTS rendimentos_tributaveis (
  id INT PRIMARY KEY AUTO_INCREMENT,
  declaracao_id INT NOT NULL,
  tipo VARCHAR(100),
  cnpj_fonte VARCHAR(18),
  nome_fonte VARCHAR(255),
  valor_rendimento DECIMAL(15, 2) DEFAULT 0,
  valor_previdencia DECIMAL(15, 2) DEFAULT 0,
  valor_irrf DECIMAL(15, 2) DEFAULT 0,
  valor_13o DECIMAL(15, 2) DEFAULT 0,
  irrf_13o DECIMAL(15, 2) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (declaracao_id) REFERENCES declaracoes(id) ON DELETE CASCADE
);

-- Tabela de Rendimentos Isentos
CREATE TABLE IF NOT EXISTS rendimentos_isentos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  declaracao_id INT NOT NULL,
  tipo VARCHAR(100),
  codigo INT,
  descricao VARCHAR(255),
  cnpj_fonte VARCHAR(18),
  nome_fonte VARCHAR(255),
  valor DECIMAL(15, 2) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (declaracao_id) REFERENCES declaracoes(id) ON DELETE CASCADE
);

-- Tabela de Deducoes
CREATE TABLE IF NOT EXISTS deducoes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  declaracao_id INT NOT NULL,
  tipo VARCHAR(100),
  codigo INT,
  descricao VARCHAR(255),
  cpf_cnpj_beneficiario VARCHAR(18),
  nome_beneficiario VARCHAR(255),
  valor DECIMAL(15, 2) DEFAULT 0,
  valor_reembolso DECIMAL(15, 2) DEFAULT 0,
  valor_dedutivel DECIMAL(15, 2) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (declaracao_id) REFERENCES declaracoes(id) ON DELETE CASCADE
);

-- Tabela de Bens e Direitos
CREATE TABLE IF NOT EXISTS bens_direitos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  declaracao_id INT NOT NULL,
  grupo INT,
  codigo INT,
  descricao TEXT,
  localizacao VARCHAR(10),
  valor_anterior DECIMAL(15, 2) DEFAULT 0,
  valor_atual DECIMAL(15, 2) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (declaracao_id) REFERENCES declaracoes(id) ON DELETE CASCADE
);

-- Tabela de Dividas e Onus
CREATE TABLE IF NOT EXISTS dividas_onus (
  id INT PRIMARY KEY AUTO_INCREMENT,
  declaracao_id INT NOT NULL,
  codigo INT,
  descricao TEXT,
  cnpj_credor VARCHAR(18),
  nome_credor VARCHAR(255),
  valor_anterior DECIMAL(15, 2) DEFAULT 0,
  valor_atual DECIMAL(15, 2) DEFAULT 0,
  valor_pago DECIMAL(15, 2) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (declaracao_id) REFERENCES declaracoes(id) ON DELETE CASCADE
);

-- Tabela de Dependentes
CREATE TABLE IF NOT EXISTS dependentes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  declaracao_id INT NOT NULL,
  tipo INT,
  cpf VARCHAR(14),
  nome VARCHAR(255),
  data_nascimento DATE,
  relacao VARCHAR(100),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (declaracao_id) REFERENCES declaracoes(id) ON DELETE CASCADE
);

-- Tabela de Agendamentos
CREATE TABLE IF NOT EXISTS agendamentos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  contribuinte_id INT,
  usuario_id INT,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  data_agendamento DATE NOT NULL,
  hora_inicio TIME,
  hora_fim TIME,
  tipo ENUM('declaracao', 'consultoria', 'revisao', 'entrega_documentos', 'outro') DEFAULT 'declaracao',
  status ENUM('agendado', 'confirmado', 'em_andamento', 'concluido', 'cancelado') DEFAULT 'agendado',
  observacoes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (contribuinte_id) REFERENCES contribuintes(id) ON DELETE SET NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Tabela de Documentos anexados aos agendamentos
CREATE TABLE IF NOT EXISTS documentos_agendamento (
  id INT PRIMARY KEY AUTO_INCREMENT,
  agendamento_id INT NOT NULL,
  nome_arquivo VARCHAR(255) NOT NULL,
  tipo_arquivo VARCHAR(100),
  tamanho_bytes INT,
  caminho_arquivo VARCHAR(500),
  url_arquivo VARCHAR(500),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON DELETE CASCADE
);

-- Tabela de Alertas
CREATE TABLE IF NOT EXISTS alertas (
  id INT PRIMARY KEY AUTO_INCREMENT,
  contribuinte_id INT,
  declaracao_id INT,
  tipo ENUM('prazo', 'pendencia', 'malha', 'documento', 'outro') DEFAULT 'outro',
  prioridade ENUM('baixa', 'media', 'alta', 'urgente') DEFAULT 'media',
  titulo VARCHAR(255) NOT NULL,
  mensagem TEXT,
  lido BOOLEAN DEFAULT FALSE,
  resolvido BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (contribuinte_id) REFERENCES contribuintes(id) ON DELETE CASCADE,
  FOREIGN KEY (declaracao_id) REFERENCES declaracoes(id) ON DELETE CASCADE
);

-- Tabela de Log de Atividades
CREATE TABLE IF NOT EXISTS log_atividades (
  id INT PRIMARY KEY AUTO_INCREMENT,
  usuario_id INT,
  acao VARCHAR(100) NOT NULL,
  entidade VARCHAR(100),
  entidade_id INT,
  detalhes TEXT,
  ip_address VARCHAR(45),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Inserir usuario admin padrao (senha: admin123)
INSERT INTO usuarios (nome, email, senha, role, cargo) VALUES 
('Administrador', 'admin@contec.com.br', '$2a$10$XQxBtGBHJE.I.j1hJQYQxuTxZ8vNBq9HYU1QqGxA5Q8QKIJ9KQXQK', 'admin', 'Administrador do Sistema')
ON DUPLICATE KEY UPDATE nome = nome;

-- Indices para performance
CREATE INDEX idx_contribuintes_cpf ON contribuintes(cpf);
CREATE INDEX idx_declaracoes_ano ON declaracoes(ano_exercicio);
CREATE INDEX idx_declaracoes_contribuinte ON declaracoes(contribuinte_id);
CREATE INDEX idx_agendamentos_data ON agendamentos(data_agendamento);
CREATE INDEX idx_alertas_contribuinte ON alertas(contribuinte_id);
