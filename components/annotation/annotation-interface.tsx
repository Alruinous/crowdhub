"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Save, ChevronRight, CheckCircle } from "lucide-react"

interface AnnotationData {
  id: string
  content: string
  labels: string[]
}

interface LabelSchema {
  categories: {
    name: string
    options: string[]
  }[]
}

interface AnnotationInterfaceProps {
  data: AnnotationData[]
  labelSchema: LabelSchema
  onSave: (annotations: Record<string, string[]>) => void
}

export function AnnotationInterface({ data, labelSchema, onSave }: AnnotationInterfaceProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [annotations, setAnnotations] = useState<Record<string, string[]>>({})

  const currentItem = data[currentIndex]
  const isLastItem = currentIndex === data.length - 1

  const handleLabelChange = (category: string, value: string, checked: boolean) => {
    setAnnotations(prev => {
      const currentLabels = prev[category] || []
      const newLabels = checked 
        ? [...currentLabels, value]
        : currentLabels.filter(label => label !== value)
      
      return {
        ...prev,
        [category]: newLabels
      }
    })
  }

  const handleNext = () => {
    if (!isLastItem) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleSave = () => {
    onSave(annotations)
  }

  const handleSkip = () => {
    handleNext()
  }

  const getCurrentAnnotations = () => {
    return annotations[currentItem.id] || []
  }

  return (
    <div className="space-y-6">
      {/* 进度指示器 */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          进度: {currentIndex + 1} / {data.length}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevious} disabled={currentIndex === 0}>
            上一项
          </Button>
          <Button variant="outline" size="sm" onClick={handleNext} disabled={isLastItem}>
            下一项
          </Button>
        </div>
      </div>

      {/* 数据内容 */}
      <Card>
        <CardHeader>
          <CardTitle>数据内容</CardTitle>
          <CardDescription>请根据以下内容进行标注</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted rounded-lg">
            <pre className="whitespace-pre-wrap text-sm">{currentItem.content}</pre>
          </div>
        </CardContent>
      </Card>

      {/* 标签选择 */}
      <Card>
        <CardHeader>
          <CardTitle>标注标签</CardTitle>
          <CardDescription>选择适用的标签</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {labelSchema.categories.map((category) => (
            <div key={category.name}>
              <Label className="text-base font-medium mb-3 block">{category.name}</Label>
              <div className="grid grid-cols-2 gap-3">
                {category.options.map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${category.name}-${option}`}
                      checked={getCurrentAnnotations().includes(option)}
                      onCheckedChange={(checked) => 
                        handleLabelChange(category.name, option, checked as boolean)
                      }
                    />
                    <Label 
                      htmlFor={`${category.name}-${option}`}
                      className="text-sm cursor-pointer"
                    >
                      {option}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleSkip}>
          <ChevronRight className="mr-2 h-4 w-4" />
          跳过
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            保存进度
          </Button>
          {isLastItem && (
            <Button onClick={handleSave}>
              <CheckCircle className="mr-2 h-4 w-4" />
              完成标注
            </Button>
          )}
        </div>
      </div>

      {/* 当前标注预览 */}
      {Object.keys(annotations).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">当前标注</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(annotations).map(([itemId, labels]) => (
                <div key={itemId} className="flex items-center gap-2 text-sm">
                  <span className="font-medium">项目 {itemId}:</span>
                  <div className="flex gap-1">
                    {labels.map((label) => (
                      <span key={label} className="bg-primary/10 text-primary px-2 py-1 rounded text-xs">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
