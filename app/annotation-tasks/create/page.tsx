"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Upload, FileText, Database, ChevronRight } from "lucide-react"

export default function CreateAnnotationTaskPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    maxWorkers: 1,
  })
  const [dataFile, setDataFile] = useState<File | null>(null)
  const [labelFile, setLabelFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadedDataFile, setUploadedDataFile] = useState<any>(null)
  const [publishCycle, setPublishCycle] = useState<number>(1) // 数据发布周期（天）
  const [publishLimit, setPublishLimit] = useState<number>(100) // 每次数据发布上限

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === "maxWorkers" ? Number(value) : value
    }))
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "data" | "label") => {
    const file = e.target.files?.[0]
    if (file) {
      if (type === "data") {
        setDataFile(file)
        setUploadedDataFile(null) // 重置上传状态
      } else {
        setLabelFile(file)
      }
    }
  }

  const handleNextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    // 验证必需的文件
    if (!dataFile) {
      setUploadError('请先选择数据文件')
      return
    }

    if (!labelFile) {
      setUploadError('请先选择标签文件')
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      // 1. 先上传数据文件
      const dataFormData = new FormData()
      dataFormData.append('file', dataFile)
      dataFormData.append('fileType', "dataFile")

      const dataUploadResponse = await fetch('/api/annotation-tasks/upload', {
        method: 'POST',
        body: dataFormData
      })

      const dataUploadResult = await dataUploadResponse.json()

      if (!dataUploadResponse.ok) {
        throw new Error(dataUploadResult.error || '数据文件上传失败')
      }

      // 2. 上传标签文件
      const labelFormData = new FormData()
      labelFormData.append('file', labelFile)
      labelFormData.append('fileType', "labelFile")
      

      const labelUploadResponse = await fetch('/api/annotation-tasks/upload', {
        method: 'POST',
        body: labelFormData
      })

      const labelUploadResult = await labelUploadResponse.json()

      if (!labelUploadResponse.ok) {
        throw new Error(labelUploadResult.error || '标签文件上传失败')
      }


      // 3. 创建标注任务并关联文件
      const taskResponse = await fetch('/api/annotation-tasks/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          dataFileId: dataUploadResult.dataFile.id,
          labelFileId: labelUploadResult.labelFile.id,
          publishCycle: publishCycle,   // 数据发布周期
          publishLimit: publishLimit     // 每次数据发布上限
        })
      })

      if (!taskResponse.ok) {
        const errorData = await taskResponse.json()
        throw new Error(errorData.error || `任务创建失败: ${taskResponse.status}`)
      }

      const task = await taskResponse.json()
      console.log('标注任务创建成功:', task)
      
      // 显示发布成功弹窗
      toast({
        title: "发布成功",
        description: `标注任务 "${formData.title}" 已成功创建`,
        duration: 1500,
      })
      
      console.log('跳转到路径: /dashboard')
      
      // 使用 setTimeout 确保路由跳转在下一个事件循环中执行
      setTimeout(() => {
        router.push("/dashboard")
      }, 500)

    } catch (error) {
      console.error('提交失败:', error)
      setUploadError(error instanceof Error ? error.message : '提交失败')
    } finally {
      setUploading(false)
    }
  }

  const steps = [
    { number: 1, title: "基本信息", description: "填写任务基本信息" },
    { number: 2, title: "数据上传", description: "上传数据文件和标签体系" },
    { number: 3, title: "任务发布配置", description: "配置数据发布策略" },
    { number: 4, title: "预览发布", description: "确认信息并发布" },
  ]

  return (
    <DashboardShell>
      <DashboardHeader 
        heading="创建数据标注任务" 
        text="按照步骤创建新的数据标注任务"
      />

      <div className="max-w-4xl mx-auto space-y-8">
        {/* 步骤指示器 */}
        <div className="flex justify-between items-center">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                currentStep >= step.number 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
              }`}>
                {step.number}
              </div>
              <div className="ml-2">
                <div className="text-sm font-medium">{step.title}</div>
                <div className="text-xs text-muted-foreground">{step.description}</div>
              </div>
              {index < steps.length - 1 && (
                <ChevronRight className="mx-4 h-4 w-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        {/* 步骤内容 */}
        <Card>
          <CardHeader>
            <CardTitle>{steps[currentStep - 1].title}</CardTitle>
            <CardDescription>{steps[currentStep - 1].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 全局错误提示：任何步骤都会显示 */}
            {uploadError && (
              <div className="p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">
                {uploadError}
              </div>
            )}
            
            {/* 步骤1: 基本信息 */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">任务标题</Label>
                  <Input
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="请输入任务标题"
                  />
                </div>
                <div>
                  <Label htmlFor="description">任务描述</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="请详细描述标注任务的要求和说明"
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="maxWorkers">最大接单者数</Label>
                    <Input
                      id="maxWorkers"
                      name="maxWorkers"
                      type="number"
                      value={formData.maxWorkers}
                      onChange={handleInputChange}
                      placeholder="1"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 步骤2: 数据上传 */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <Label>数据文件上传 <span className="text-red-500">*</span></Label>
                  <div className="mt-2 border-2 border-dashed rounded-lg p-6 text-center">
                    <Database className="mx-auto h-8 w-8 text-muted-foreground" />
                    <div className="mt-2">
                      <Label htmlFor="data-file" className="cursor-pointer">
                        <Button variant="outline" asChild disabled={uploading}>
                          <span>
                            <Upload className="mr-2 h-4 w-4" />
                            {uploading ? "上传中..." : "选择数据文件"}
                          </span>
                        </Button>
                      </Label>
                      <Input
                        id="data-file"
                        type="file"
                        accept=".csv,.xlsx"
                        onChange={(e) => handleFileUpload(e, "data")}
                        className="hidden"
                        disabled={uploading}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      支持 CSV、Excel 格式，文件大小不超过 10MB
                    </p>
                    
                    {/* 上传状态显示 */}
                    {uploading && (
                      <div className="mt-2 text-sm text-blue-600">
                        正在上传文件...
                      </div>
                    )}
                    
                    {dataFile && (
                      <div className="mt-2 text-sm text-green-600">
                        已选择: {dataFile.name}
                        <div className="text-xs text-muted-foreground">
                          (将在发布任务时上传)
                        </div>
                      </div>
                    )}
                    
                    {uploadError && (
                      <div className="mt-2 text-sm text-red-600">
                        {uploadError}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label>标签体系文件 <span className="text-red-500">*</span></Label>
                  <div className="mt-2 border-2 border-dashed rounded-lg p-6 text-center">
                    <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                    <div className="mt-2">
                      <Label htmlFor="label-file" className="cursor-pointer">
                        <Button variant="outline" asChild disabled={uploading}>
                          <span>
                            <Upload className="mr-2 h-4 w-4" />
                            {uploading ? "上传中..." : "选择标签文件"}
                          </span>
                        </Button>
                      </Label>
                      <Input
                        id="label-file"
                        type="file"
                        accept=".csv,.xlsx"
                        onChange={(e) => handleFileUpload(e, "label")}
                        className="hidden"
                        disabled={uploading}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      支持 JSON、CSV、Excel 格式，包含标签体系定义
                    </p>
                    
                    {uploading && (
                      <div className="mt-2 text-sm text-blue-600">
                        正在上传文件...
                      </div>
                    )}
                    
                    {labelFile && (
                      <div className="mt-2 text-sm text-green-600">
                        已选择: {labelFile.name}
                        <div className="text-xs text-muted-foreground">
                          (将在发布任务时上传)
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 步骤3: 任务发布配置 */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <Label htmlFor="publish-cycle">数据发布周期</Label>
                  <div className="mt-2">
                    <Input
                      id="publish-cycle"
                      type="number"
                      min="1"
                      value={publishCycle}
                      onChange={(e) => setPublishCycle(Number(e.target.value))}
                      placeholder="1"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      每隔多少天发布一次新数据（单位：天）
                    </p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="publish-limit">每人每次数据发布上限</Label>
                  <div className="mt-2">
                    <Input
                      id="publish-limit"
                      type="number"
                      min="1"
                      value={publishLimit}
                      onChange={(e) => setPublishLimit(Number(e.target.value))}
                      placeholder="100"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      每次最多给每人发布多少条数据（单位：条）
                    </p>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    💡 <strong>发布策略说明：</strong><br/>
                    系统将按照设定的周期自动发布数据。<br/>
                    例如：设置周期为 {publishCycle} 天，每人每次发布 {publishLimit} 条，
                    则系统每 {publishCycle} 天会自动发布最多 {publishLimit} * n（接单人数）条新数据供标注者认领。
                  </p>
                </div>
              </div>
            )}

            {/* 步骤4: 预览发布 */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>任务标题</Label>
                    <div className="mt-1 text-sm">{formData.title}</div>
                  </div>
                </div>
                <div>
                  <Label>任务描述</Label>
                  <div className="mt-1 text-sm">{formData.description}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>数据文件</Label>
                    <div className="mt-1 text-sm">
                      {dataFile?.name || "未选择"}
                      {dataFile && (
                        <div className="text-xs text-blue-600">
                          ⏳ 将在发布时上传
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>标签文件</Label>
                    <div className="mt-1 text-sm">
                      {labelFile?.name || "未选择"}
                      {labelFile && (
                        <div className="text-xs text-blue-600">
                          ⏳ 将在发布时上传
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* 显示文件信息预览 */}
                {dataFile && (
                  <div>
                    <Label>文件信息</Label>
                    <div className="mt-1 text-sm bg-muted p-3 rounded">
                      <div>文件名: {dataFile.name}</div>
                      <div>文件大小: {(dataFile.size / 1024).toFixed(2)} KB</div>
                      <div className="text-xs text-muted-foreground">
                        文件将在发布任务时上传到服务器
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 导航按钮 */}
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={handlePrevStep}
                disabled={currentStep === 1}
              >
                上一步
              </Button>
              {currentStep < 4 ? (
                <Button onClick={handleNextStep}>
                  下一步
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={uploading}>
                  {uploading ? "发布中..." : "发布任务"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
