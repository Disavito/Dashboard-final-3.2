export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      boletas_electronicas: {
        Row: {
          id: number
          created_at: string
          serie: string
          numero: string
          fecha_emision: string
          moneda: string
          monto_total: number
          cliente_tipo_documento: string
          cliente_numero_documento: string
          cliente_razon_social: string
          cliente_direccion: string | null
          detalles: Json | null
          socio_id: string | null // FIX: Changed from number to string (UUID)
          api_invoice_id: number | null
        }
        Insert: {
          id?: number
          created_at?: string
          serie: string
          numero: string
          fecha_emision: string
          moneda: string
          monto_total: number
          cliente_tipo_documento: string
          cliente_numero_documento: string
          cliente_razon_social: string
          cliente_direccion?: string | null
          detalles?: Json | null
          socio_id?: string | null // FIX: Changed from number to string (UUID)
          api_invoice_id?: number | null
        }
        Update: {
          id?: number
          created_at?: string
          serie?: string
          numero?: string
          fecha_emision?: string
          moneda?: string
          monto_total?: number
          cliente_tipo_documento?: string
          cliente_numero_documento?: string
          cliente_razon_social?: string
          cliente_direccion?: string | null
          detalles?: Json | null
          socio_id?: string | null // FIX: Changed from number to string (UUID)
          api_invoice_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "boletas_electronicas_socio_id_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "socio_titulares"
            referencedColumns: ["id"]
          }
        ]
      }
      notas_credito: {
        Row: {
          id: number
          created_at: string
          serie: string
          numero: string
          fecha_emision: string
          moneda: string
          monto_total: number
          documento_afectado_serie_numero: string
          motivo_codigo: string
          motivo_descripcion: string
          boleta_id: number | null
          factura_id: number | null
          api_credit_note_id: number | null
        }
        Insert: {
          id?: number
          created_at?: string
          serie: string
          numero: string
          fecha_emision: string
          moneda: string
          monto_total: number
          documento_afectado_serie_numero: string
          motivo_codigo: string
          motivo_descripcion: string
          boleta_id?: number | null
          factura_id?: number | null
          api_credit_note_id?: number | null
        }
        Update: {
          id?: number
          created_at?: string
          serie?: string
          numero?: string
          fecha_emision?: string
          moneda?: string
          monto_total?: number
          documento_afectado_serie_numero?: string
          motivo_codigo?: string
          motivo_descripcion?: string
          boleta_id?: number | null
          factura_id?: number | null
          api_credit_note_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_credito_boleta_id_fkey"
            columns: ["boleta_id"]
            isOneToOne: false
            referencedRelation: "boletas_electronicas"
            referencedColumns: ["id"]
          }
        ]
      }
      ingresos: {
        Row: {
          id: number
          receipt_number: string
          dni: string
          full_name: string
          amount: number
          account: string
          date: string
          transaction_type: string
          created_at: string
          numeroOperacion: number | null
        }
        Insert: {
          id?: number
          receipt_number: string
          dni: string
          full_name: string
          amount: number
          account: string
          date: string
          transaction_type: string
          created_at?: string
          numeroOperacion?: number | null
        }
        Update: {
          id?: number
          receipt_number?: string
          dni?: string
          full_name?: string
          amount?: number
          account?: string
          date?: string
          transaction_type?: string
          created_at?: string
          numeroOperacion?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ingresos_account_fkey"
            columns: ["account"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "ingresos_dni_fkey"
            columns: ["dni"]
            isOneToOne: false
            referencedRelation: "socio_titulares"
            referencedColumns: ["dni"]
          }
        ]
      }
      cuentas: {
        Row: {
          id: number
          name: string
          created_at: string
        }
        Insert: {
          id?: number
          name: string
          created_at?: string
        }
        Update: {
          id?: number
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      gastos: {
        Row: {
          id: number
          created_at: string
          account: string
          amount: number
          date: string
          description: string | null
          category: string | null
          sub_category: string | null
          numero_gasto: string | null
          colaborador_id: string | null
        }
        Insert: {
          id?: number
          created_at?: string
          account: string
          amount: number
          date: string
          description?: string | null
          category?: string | null
          sub_category?: string | null
          numero_gasto?: string | null
          colaborador_id?: string | null
        }
        Update: {
          id?: number
          created_at?: string
          account?: string
          amount?: number
          date?: string
          description?: string | null
          category?: string | null
          sub_category?: string | null
          numero_gasto?: string | null
          colaborador_id?: string | null
        }
        Relationships: []
      }
      socio_titulares: {
        Row: {
          id: string // FIX: Changed from number to string (UUID)
          created_at: string
          dni: string
          nombres: string
          apellidoPaterno: string
          apellidoMaterno: string
          fechaNacimiento: string
          edad: number | null
          celular: string | null
          situacionEconomica: string
          direccionDNI: string
          regionDNI: string
          provinciaDNI: string
          distritoDNI: string
          localidad: string
          regionVivienda: string | null
          provinciaVivienda: string | null
          distritoVivienda: string | null
          direccionVivienda: string | null
          mz: string | null
          lote: string | null
          isObservado: boolean | null // ADDED: isObservado
          observacion: string | null // ADDED: observacion
          is_lote_medido: boolean | null // NEW: is_lote_medido
        }
        Insert: {
          id?: string // FIX: Changed from number to string (UUID)
          created_at?: string
          dni: string
          nombres: string
          apellidoPaterno: string
          apellidoMaterno: string
          fechaNacimiento: string
          edad?: number | null
          celular?: string | null
          situacionEconomica: string
          direccionDNI: string
          regionDNI: string
          provinciaDNI: string
          distritoDNI: string
          localidad: string
          regionVivienda?: string | null
          provinciaVivienda?: string | null
          distritoVivienda?: string | null
          direccionVivienda?: string | null
          mz?: string | null
          lote?: string | null
          isObservado?: boolean | null // ADDED: isObservado
          observacion?: string | null // ADDED: observacion
          is_lote_medido?: boolean | null // NEW: is_lote_medido
        }
        Update: {
          id?: string // FIX: Changed from number to string (UUID)
          created_at?: string
          dni?: string
          nombres?: string
          apellidoPaterno?: string
          apellidoMaterno?: string
          fechaNacimiento?: string
          edad?: number | null
          celular?: string | null
          situacionEconomica?: string
          direccionDNI?: string
          regionDNI?: string
          provinciaDNI?: string
          distritoDNI?: string
          localidad?: string
          regionVivienda?: string | null
          provinciaVivienda?: string | null
          distritoVivienda?: string | null
          direccionVivienda?: string | null
          mz?: string | null
          lote?: string | null
          isObservado?: boolean | null // ADDED: isObservado
          observacion?: string | null // ADDED: observacion
          is_lote_medido?: boolean | null // NEW: is_lote_medido
        }
        Relationships: []
      }
      socio_documentos: {
        Row: {
          id: number
          created_at: string
          socio_id: string // FIX: Changed from number to string (UUID)
          tipo_documento: string
          link_documento: string
        }
        Insert: {
          id?: number
          created_at?: string
          socio_id: string // FIX: Changed from number to string (UUID)
          tipo_documento: string
          link_documento: string
        }
        Update: {
          id?: number
          created_at?: string
          socio_id?: string // FIX: Changed from number to string (UUID)
          tipo_documento?: string
          link_documento?: string
        }
        Relationships: [
          {
            foreignKeyName: "socio_documentos_socio_id_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "socio_titulares"
            referencedColumns: ["id"]
          }
        ]
      }
      colaboradores: {
        Row: {
          id: string
          name: string
          dni: string | null
          apellidos: string | null
          cargo: string | null
          created_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          name: string
          dni?: string | null
          apellidos?: string | null
          cargo?: string | null
          created_at?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          dni?: string | null
          apellidos?: string | null
          cargo?: string | null
          created_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      registros_jornada: {
        Row: {
          id: number
          created_at: string
          colaborador_id: string
          fecha: string
          hora_inicio_jornada: string | null
          hora_inicio_almuerzo: string | null
          hora_fin_almuerzo: string | null
          hora_fin_jornada: string | null
        }
        Insert: {
          id?: number
          created_at?: string
          colaborador_id: string
          fecha: string
          hora_inicio_jornada?: string | null
          hora_inicio_almuerzo?: string | null
          hora_fin_almuerzo?: string | null
          hora_fin_jornada?: string | null
        }
        Update: {
          id?: number
          created_at?: string
          colaborador_id?: string
          fecha?: string
          hora_inicio_jornada?: string | null
          hora_inicio_almuerzo?: string | null
          hora_fin_almuerzo?: string | null
          hora_fin_jornada?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registros_jornada_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          role: string | null
        }
        Insert: {
          id: string
          role?: string | null
        }
        Update: {
          id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["role_name"]
          }
        ]
      }
      roles: {
        Row: {
          id: number
          role_name: string
        }
        Insert: {
          id?: number
          role_name: string
        }
        Update: {
          id?: number
          role_name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          user_id: string
          role_id: number
        }
        Insert: {
          user_id: string
          role_id: number
        }
        Update: {
          user_id?: string
          role_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      resource_permissions: {
        Row: {
          id: string
          created_at: string
          role_id: number
          resource_path: string
          can_access: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          role_id: number
          resource_path: string
          can_access?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          role_id?: number
          resource_path?: string
          can_access?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "resource_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          }
        ]
      }
      resumenes_diarios: {
        Row: {
          id: number
          created_at: string
          fecha_resumen: string
          numero_completo: string
          correlativo: string
          ticket: string
          estado_sunat: string | null
          summary_api_id: number | null
        }
        Insert: {
          id?: number
          created_at?: string
          fecha_resumen: string
          numero_completo: string
          correlativo: string
          ticket: string
          estado_sunat?: string | null
          summary_api_id?: number | null
        }
        Update: {
          id?: number
          created_at?: string
          fecha_resumen?: string
          numero_completo?: string
          correlativo?: string
          ticket?: string
          estado_sunat?: string | null
          summary_api_id?: number | null
        }
        Relationships: []
      }
      resumen_diario_boletas: {
        Row: {
          id: number
          resumen_id: number
          serie_numero: string
        }
        Insert: {
          id?: number
          resumen_id: number
          serie_numero: string
        }
        Update: {
          id?: number
          resumen_id?: number
          serie_numero?: string
        }
        Relationships: [
          {
            foreignKeyName: "resumen_diario_boletas_resumen_id_fkey"
            columns: ["resumen_id"]
            isOneToOne: false
            referencedRelation: "resumenes_diarios"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database['public']['Tables'] & Database['public']['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database['public']['Tables'] &
        Database['public']['Views'])
    ? (Database['public']['Tables'] &
        Database['public']['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database['public']['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database['public']['Tables']
    ? Database['public']['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database['public']['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database['public']['Tables']
    ? Database['public']['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database['public']['Enums']
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof Database['public']['Enums']
    ? Database['public']['Enums'][PublicEnumNameOrOptions]
    : never
