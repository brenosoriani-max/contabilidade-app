"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  FileText, 
  Loader2, 
  AlertCircle, 
  Shield, 
  BarChart3, 
  Users, 
  Clock,
  CheckCircle2,
  ArrowRight,
  Eye,
  EyeOff,
  LogIn
} from "lucide-react"
import Link from "next/link"

const features = [
  {
    icon: FileText,
    title: "Importacao de XML",
    description: "Importe declaracoes IRPF diretamente do arquivo XML da Receita Federal"
  },
  {
    icon: BarChart3,
    title: "Analise Completa",
    description: "Visualize metricas detalhadas e calculos tributarios automaticos"
  },
  {
    icon: Users,
    title: "Gestao de Clientes",
    description: "Organize e gerencie todos os seus contribuintes em um so lugar"
  },
  {
    icon: Clock,
    title: "Agendamentos",
    description: "Calendario integrado para acompanhar prazos e reunioes"
  }
]

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    const result = await login(email, password)

    if (result.success) {
      toast.success("Login realizado com sucesso!", {
        description: "Bem-vindo de volta!",
        duration: 3000,
        style: {
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "16px 20px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          maxWidth: "380px",
        },
        descriptionClassName: "text-slate-500 text-sm",
        icon: <LogIn className="h-5 w-5 text-emerald-600" />,
      })
     
      setTimeout(() => {
        router.push("/dashboard")
      }, 500)
    } else {
      setError(result.error || "Erro ao fazer login")
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding & Features */}
     <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#f8fafc] via-[#eef2f7] to-[#dbe4f0] relative overflow-hidden border-r border-slate-200">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500 rounded-full filter blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-red-500 rounded-full filter blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(180, 179, 179, 0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255, 255, 255, 0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
        
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            
            <div>
              <img src="logo-contec.png" alt="CONTEC" className="h-20 w-auto" />
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-8">
            <div>
              <h2 className="text-4xl font-bold text-bold leading-tight text-balance">
                Simplifique sua gestao de
               <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-red-600">
                  {" "}Imposto de Renda
                </span>
              </h2>
              <p className="mt-4 text-lg text-slate-400 leading-relaxed max-w-md">
                Plataforma completa para escritorios de contabilidade analisarem e gerenciarem declaracoes IRPF de forma eficiente.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <div 
                  key={index}
                  className="group p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                >
                  <feature.icon className="h-8 w-8 text-red-400 mb-3" />
                  <h3 className="font-semibold text-bold text-sm">{feature.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Dados seguros
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Conformidade fiscal
            </span>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg">
              <FileText className="h-6 w-6 text-bold" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">ANALIR</h1>
              <p className="text-sm text-muted-foreground">by CONTEC</p>
            </div>
          </div>

          {/* Form Header */}
          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold text-foreground">Bem-vindo de volta</h2>
            <p className="mt-2 text-muted-foreground">
              Entre com suas credenciais para acessar sua conta
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 bg-secondary/50 border-border focus:bg-background transition-colors"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">
                  Senha
                </Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 bg-secondary/50 border-border focus:bg-background transition-colors pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox 
                id="remember" 
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              />
              <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                Lembrar de mim
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-lg shadow-primary/25 transition-all"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

         
        

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground">
            Ao entrar, voce concorda com nossos{" "}
            <Link href="#" className="text-primary hover:underline">Termos de Servico</Link>
            {" "}e{" "}
            <Link href="#" className="text-primary hover:underline">Politica de Privacidade</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
