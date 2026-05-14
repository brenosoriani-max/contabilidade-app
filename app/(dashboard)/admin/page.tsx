"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { AppHeader } from "@/components/app-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertCircle, Check, Edit, Loader2, Shield, Trash2, UserPlus, Users, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { userService } from "@/lib/api/services"
import { formatDateTime } from "@/lib/format"
import type { SafeUser, UserRole } from "@/types"

const emptyForm = {
  nome: "",
  email: "",
  senha: "",
  role: "contador" as UserRole,
  telefone: "",
  cargo: "",
  ativo: true,
}

export default function AdminPage() {
  const { isAdmin, isLoading } = useAuth()
  const router = useRouter()
  const { data, error: loadError, mutate } = useSWR(isAdmin ? "usuarios" : null, () => userService.list())
  const users = data?.usuarios ?? []
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<SafeUser | null>(null)
  const [deleteUser, setDeleteUser] = useState<SafeUser | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAdmin) router.push("/dashboard")
  }, [isAdmin, isLoading, router])

  if (isLoading || !isAdmin) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  const resetForm = () => {
    setFormData(emptyForm)
    setError("")
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      if (!formData.nome || !formData.email || (!editUser && !formData.senha)) {
        setError("Preencha todos os campos obrigatorios")
        setIsSubmitting(false)
        return
      }

      if (editUser) {
        await userService.update(editUser.id, formData)
        setSuccess("Usuario atualizado com sucesso!")
        setEditUser(null)
        toast.success("Usuário atualizado!", {
          description: "As informações foram salvas com sucesso.",
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
          icon: <Check className="h-5 w-5 text-emerald-600" />,
        })
      } else {
        await userService.create(formData)
        setSuccess("Usuario criado com sucesso!")
        setIsCreateOpen(false)
        toast.success("Usuário criado!", {
          description: `${formData.nome} foi adicionado ao sistema.`,
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
          icon: <UserPlus className="h-5 w-5 text-emerald-600" />,
        })
      }

      resetForm()
      await mutate()
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar usuario")
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, editUser, mutate])

  const handleDeleteUser = useCallback(async () => {
    if (!deleteUser) return
    try {
      await userService.remove(deleteUser.id)
      toast.warning(`Usuário excluído`, {
        description: `${deleteUser.nome} foi removido do sistema.`,
        duration: 4000,
        style: {
          background: "#fffbeb",
          border: "1px solid #fcd34d",
          borderRadius: "12px",
          padding: "16px 20px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          maxWidth: "380px",
        },
        descriptionClassName: "text-amber-700 text-sm",
        icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
      })
      setDeleteUser(null)
      await mutate()
    } catch (err) {
      toast.error("Erro ao excluir usuário", {
        description: "Não foi possível remover o usuário. Tente novamente.",
      })
    }
  }, [deleteUser, mutate])

  const openEditDialog = useCallback((user: SafeUser) => {
    setEditUser(user)
    setFormData({
      nome: user.nome,
      email: user.email,
      senha: "",
      role: user.role,
      telefone: user.telefone || "",
      cargo: user.cargo || "",
      ativo: user.ativo,
    })
  }, [])

  const adminCount = useMemo(() => users.filter((u) => u.role === "admin").length, [users])

  return (
    <>
      <AppHeader title="Painel Administrativo" description="Gerenciamento de usuarios do sistema" />
      <main className="flex-1 overflow-auto p-6 space-y-6">
        {success && <Alert className="bg-emerald-50 border-emerald-200"><Check className="h-4 w-4 text-emerald-600" /><AlertTitle>Sucesso</AlertTitle><AlertDescription>{success}</AlertDescription></Alert>}
        {loadError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Nao foi possivel carregar usuarios.</AlertDescription></Alert>}

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-muted-foreground">Total de Usuarios</CardTitle><Users className="h-4 w-4 text-blue-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{users.length}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-muted-foreground">Administradores</CardTitle><Shield className="h-4 w-4 text-amber-600" /></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">{adminCount}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-muted-foreground">Ativos</CardTitle><Users className="h-4 w-4 text-emerald-600" /></CardHeader><CardContent><div className="text-2xl font-bold text-emerald-600">{users.filter((u) => u.ativo).length}</div></CardContent></Card>
        </div>

          <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-xl font-semibold tracking-tight">
                Usuários do Sistema
              </CardTitle>

              <CardDescription className="mt-1">
                Gerencie os usuários com acesso ao ANALIR
              </CardDescription>
            </div>

            <Button
              onClick={() => {
                resetForm()
                setIsCreateOpen(true)
              }}
              className="gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Novo Usuário
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-6">Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Função</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">
                    Criado em
                  </TableHead>
                  <TableHead className="text-right pr-6">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-32 text-center text-muted-foreground"
                    >
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow
                      key={user.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      {/* NOME */}
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <span className="text-sm font-semibold text-primary">
                              {user.nome.charAt(0).toUpperCase()}
                            </span>
                          </div>

                          <div className="space-y-0.5">
                            <p className="font-medium leading-none">
                              {user.nome}
                            </p>

                            {user.cargo && (
                              <p className="text-xs text-muted-foreground">
                                {user.cargo}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* EMAIL */}
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">
                            {user.email}
                          </span>

                          {user.telefone && (
                            <span className="text-xs text-muted-foreground">
                              {user.telefone}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* FUNÇÃO */}
                      <TableCell className="text-center">
                        <Badge
                          variant={user.role === "admin" ? "default" : "secondary"}
                          className="capitalize px-3 py-1"
                        >
                          {user.role === "admin"
                            ? "Administrador"
                            : user.role === "contador"
                            ? "Contador"
                            : "Assistente"}
                        </Badge>
                      </TableCell>

                      {/* STATUS */}
                      <TableCell className="text-center">
                        <Badge
                          variant={user.ativo ? "secondary" : "destructive"}
                          className={user.ativo ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}
                        >
                          <div className="flex items-center gap-1.5">
                            <div
                              className={`h-2 w-2 rounded-full ${user.ativo ? "bg-emerald-500" : "bg-red-500"}`}
                            />
                            {user.ativo ? "Ativo" : "Inativo"}
                          </div>
                        </Badge>
                      </TableCell>

                      {/* DATA */}
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {formatDateTime(user.createdAt)}
                      </TableCell>

                      {/* AÇÕES */}
                      <TableCell className="pr-6">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openEditDialog(user)}
                            className="h-9 w-9 border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setDeleteUser(user)}
                            disabled={user.role === "admin" && adminCount === 1}
                            className="h-9 w-9 border-red-200 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
          </Card>
      </main>

      {/* Create User Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { if (!open) { setIsCreateOpen(false); resetForm() } }}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <UserPlus className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">
                  Criar Novo Usuário
               </DialogTitle>
                <DialogDescription className="text-sm mt-0.5">
                  Preencha os dados para criar um novo usuário no sistema
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {error && (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="nome-create" className="text-sm font-medium">
                    Nome completo *
                  </Label>
                  <Input
                    id="nome-create"
                    placeholder="Digite o name completo"
                    value={formData.nome}
                    onChange={(e) => setFormData((p) => ({ ...p, nome: e.target.value }))}
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email-create" className="text-sm font-medium">
                    Email *
                  </Label>
                  <Input
                    id="email-create"
                    type="email"
                    placeholder="exemplo@empresa.com"
                    value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="senha-create" className="text-sm font-medium">
                    Senha *
                  </Label>
                  <Input
                    id="senha-create"
                    type="password"
                    placeholder="Digite a senha"
                    value={formData.senha}
                    onChange={(e) => setFormData((p) => ({ ...p, senha: e.target.value }))}
                    className="h-10"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Função *</Label>
                    <Select value={formData.role} onValueChange={(role: UserRole) => setFormData((p) => ({ ...p, role }))}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecione a função" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assistente">Assistente</SelectItem>
                        <SelectItem value="contador">Contador</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cargo-create" className="text-sm font-medium">
                      Cargo
                    </Label>
                    <Input
                      id="cargo-create"
                      placeholder="Ex: Gerente"
                      value={formData.cargo}
                      onChange={(e) => setFormData((p) => ({ ...p, cargo: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setIsCreateOpen(false); resetForm() }}
                className="px-4"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Criar usuário
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) { setEditUser(null); resetForm() } }}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <Edit className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">
                  Editar Usuário
                </DialogTitle>
                <DialogDescription className="text-sm mt-0.5">
                  Atualize as informações do usuário
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {editUser && (
            <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border/50">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <span className="text-sm font-semibold text-primary">
                  {editUser.nome.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{editUser.nome}</p>
                <p className="text-xs text-muted-foreground truncate">{editUser.email}</p>
              </div>
              <Badge variant={editUser.role === "admin" ? "default" : "secondary"} className="capitalize">
                {editUser.role}
              </Badge>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {error && (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="nome-edit" className="text-sm font-medium">
                    Nome completo *
                  </Label>
                  <Input
                    id="nome-edit"
                    placeholder="Digite o nome completo"
                    value={formData.nome}
                    onChange={(e) => setFormData((p) => ({ ...p, nome: e.target.value }))}
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email-edit" className="text-sm font-medium">
                    Email *
                  </Label>
                  <Input
                    id="email-edit"
                    type="email"
                    placeholder="exemplo@empresa.com"
                    value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="senha-edit" className="text-sm font-medium">
                    Senha <span className="text-muted-foreground font-normal">(deixe em branco para manter a atual)</span>
                  </Label>
                  <Input
                    id="senha-edit"
                    type="password"
                    placeholder="••••••••"
                    value={formData.senha}
                    onChange={(e) => setFormData((p) => ({ ...p, senha: e.target.value }))}
                    className="h-10"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Função *</Label>
                    <Select value={formData.role} onValueChange={(role: UserRole) => setFormData((p) => ({ ...p, role }))}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecione a função" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assistente">Assistente</SelectItem>
                        <SelectItem value="contador">Contador</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cargo-edit" className="text-sm font-medium">
                      Cargo
                    </Label>
                    <Input
                      id="cargo-edit"
                      placeholder="Ex: Gerente"
                      value={formData.cargo}
                      onChange={(e) => setFormData((p) => ({ ...p, cargo: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setEditUser(null); resetForm() }}
                className="px-4"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Atualizar
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteUser} onOpenChange={(open) => { if (!open) setDeleteUser(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir{" "}
              <strong>{deleteUser?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
